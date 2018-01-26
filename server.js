"use strict"

const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const express = require('express')
const http = require('http')
const spdy = require('spdy')
const url = require("url")
const path = require("path")
const fs = require("fs")
const WebSocket = require('ws')
const SecurityHandler = require("./security.js")
const fileUpload = require('express-fileupload');
const js2xmlparser = require('js2xmlparser')

//Run using --harmony-async-await on node version 7+

class Server{

  constructor(mscp){
    this.mscp = mscp
    this.definition = mscp.definition
    this.handlerClasses = typeof mscp.server.handlerClass === "function" ? {"": mscp.server.handlerClass} : mscp.server.handlerClass
    this.handlerGlobal = mscp.server.handlerGlobal
    this.handlerClassNamespaces = {}
    this.uses = mscp.server.uses
    this.statics = mscp.server.statics
    this.parentMSCP = mscp.server.parentMSCP
    this.rootPath = mscp.server.rootPath || "/"
    this.setupHandler = mscp.setupHandler
  }

  async run(callingPort){
    this.security = new SecurityHandler(this.mscp)
    await this.security.init()

    this.initHandler()

    var app = null;
    if(this.parentMSCP !== undefined){
      app = this.parentMSCP.server
    } else {
      app = express()

      if(this.setupHandler.setup.trustProxy === true){
        app.enable('trust proxy')
      }

      app.use(fileUpload())
      app.use(bodyParser.urlencoded({extended: true }))
      app.use(bodyParser.json())
      app.use(cookieParser());
      app.use(async (req, res, next) => await this.security.onRequest.call(this.security, req, res, next));
    }

    app.use(`${this.rootPath}api/browse`, express.static(path.join(__dirname, "www/apibrowser")))
    app.use(`${this.rootPath}api`, async (req, res) => await this.handleAPIRequest(req, res));
    app.use(`${this.rootPath}mscp/libs`, express.static(require("mscp-browserlibs")))
    app.use(`${this.rootPath}mscp`, express.static(path.join(__dirname, "www")))
    app.use(`${this.rootPath}mscpapi`, async (req, res) => await this.setupHandler.handleJSONRequest.call(this.setupHandler, req, res))

    if(this.setupHandler.setup.enableUI !== false){
      let uiSetup = this.setupHandler.setup.ui
      if(uiSetup === undefined || uiSetup.apps === undefined){

        let uiSetupJSON = await new Promise((resolve, reject) => {
          try{
            fs.readFile("./ui.json", "utf-8", (err, data) => err?resolve(null):resolve(data))
          } catch(err){
            resolve(null)
          }
        })
        if(uiSetupJSON)
          uiSetup = JSON.parse(uiSetupJSON)
      }

      if(uiSetup){
        for(let a in uiSetup.apps){
          app.use(`${this.rootPath}${a}`, express.static(path.join(__dirname, "www/ui")))
        }
        app.use(`${this.rootPath}uidef`, (req, res) => {
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify(uiSetup, null, 2))
        })
        app.use(`${this.rootPath}mscpui/static`, express.static(path.join(__dirname, "www/ui")))
      }
    }

    for(let use of this.uses)
      app.use.apply(app, use)

    for(let s of this.statics)
      app.use(`${s.rootPath}`, express.static(s.wwwPath))

    if(this.setupHandler.setup.attemptAPIOnUnresolvedPaths === true){
      app.use(async (req, res) => await this.handleAPIRequest(req, res));
    }

    if(this.parentMSCP !== undefined){
      return; //Do not setup server, if there is a parent
    }

    const server = http.createServer(app)

    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
      const location = url.parse(ws.upgradeReq.url, true);
      // You might use location.query.access_token to authenticate or share sessions
      // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
      this.mscp.client.connectionManager.onNewConnection(ws)
    });

    let port = callingPort || process.env.PORT || this.setupHandler.setup.port || this.setupHandler.setup.http_port || 8080
    if(this.setupHandler.setup.enableHTTP !== false)
      server.listen(port, () => (console.log(`Service ${this.definition.name} started on port ${port} (http)`)))

    if(this.setupHandler.setup.enableHTTPS === true){
      let options = {}
      if(this.setupHandler.setup.https_key && this.setupHandler.setup.https_cert){
        options = {
        		  key: fs.readFileSync(this.setupHandler.setup.https_key),
        		  cert: fs.readFileSync(this.setupHandler.setup.https_cert),
        		  ca: this.setupHandler.setup.https_ca ? fs.readFileSync(this.setupHandler.setup.https_ca) : undefined,
        		};
      } else {
        console.log("Missing certificates. Need https_key, https_cert and https_ca")
      }

      let sslPort = this.setupHandler.setup.https_port || 443
      spdy.createServer(options, app).listen(sslPort, () => {
        console.log(`Service ${this.definition.name} started on port ${sslPort} (https)`);
      })
    }
  }

  async handleAPIRequest (req, res){
    var data = req.body;
    if(data === undefined || (Object.keys(data).length === 0 && data.constructor === Object))
      data = req.query;

    if(data === undefined){
      res.end("Invalid request!");
      return;
    }
    var apiPath = url.parse(req.url).pathname.substring(1);

    var respond = (result, contentType, isBinary) => {
      if(result !== null && result !== undefined){
        let cType = contentType === undefined ? 'application/json' : contentType

        if(typeof result == "string"){
          res.writeHead(200, {'Content-Type': cType});
          res.end(result);
        } else if(typeof result == "object" && isBinary){
          res.writeHead(200, {'Content-Type': cType});
          res.end(result, 'binary')
        } else if(data.responseType === 'xml'){
          res.writeHead(200, {'Content-Type': 'text/xml'});
          res.end(js2xmlparser.parse("root", result))
        } else {
          res.writeHead(200, {'Content-Type': cType});
          res.end(JSON.stringify(result, null, 2));
        }
      } else {
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error: "Invalid response. Server Error. ", apiPath: apiPath, data: data, baseUrl: req.baseUrl}, null, 2));
      }
    }

    var response = null;

    if(apiPath == ""){
      response = this.getFullDefForClient()
    } else {
      response = await this.handleRequest(apiPath, data, req, res)
    }

    if(typeof response === "object" && response.type == "download" && typeof response.file.path == "string"){
      let file = response.file
      let responseFilename = file.name ? file.name : path.basename(file.path)
      res.download(file.path, responseFilename)

    } else if(typeof response === "object" && response.type == "response"){
      respond(response.data, response.contentType, response.isBinary)

    } else if(typeof response !== "object" || response.type != "custom"){
      respond(response)
    }
  }

  getFullDefForClient(){
    let fullDef = JSON.parse(JSON.stringify(this.definition))
    if(this.setupHandler.setup.forwards !== undefined){
      for(let f of this.setupHandler.setup.forwards){
        fullDef.serve.push(this.functionDef[f.function.toLowerCase()])
      }
    }
    return fullDef;
  }

  async initHandler(){
    this.handler = new (this.handlerClasses[""])()
    let h = this.handler
    let def = this.definition

    if(this.handlerGlobal === undefined) //Allow caller to override
      this.handlerGlobal = {}

    h.mscp = this.mscp
    h.definition = this.definition
    h.request = null
    h.global = this.handlerGlobal

    if(typeof h.initFirst === "function")
      await h.initFirst()

    this.functionDef = {}

    if(def.serve === undefined)
      def.serve = []

    // Init namespace handlers
    for(let s of def.serve){
      if(!s.namespace)
        continue

      if(typeof this.handler[s.namespace] !== "object"){
        if(this.handlerClasses[s.namespace] !== undefined){
          this.handler[s.namespace] = new (this.handlerClasses[s.namespace])()
          this.handler[s.namespace].mscp = this.mscp
          this.handler[s.namespace].definition = this.definition
          this.handler[s.namespace].global = this.handlerGlobal
          if(typeof this.handler[s.namespace].initFirst === "function"){
            this.handler[s.namespace].initFirst()
          }
        } else {
          this.handlerClasses[s.namespace] = function(){}
        }
      }
    }

    for(let s of def.serve){

      if(!s.name){
        console.log("Missing name of funciton " + s)
        continue;
      }

      if(!s.args){
        console.log("Missing args of function " + s.name)
        continue;
      }

      if(s.namespace){
        if(this.handler[s.namespace] === undefined){
          this.handler[s.namespace] = {}
        }

        if(this.handler[s.namespace][s.name] === undefined){
          this.handler[s.namespace][s.name] = async function(...args){
            return {error: "Not implemented"}
          }
        }

        this.functionDef[s.namespace + '.' + s.name.toLowerCase()] = s;
      } else {
        if(this.handler[s.name] === undefined){
          this.handler[s.name] = async function(...args){
            return {error: "Not implemented"}
          }
        }

        this.functionDef[s.name.toLowerCase()] = s;
      }
    }

    let setup = this.setupHandler.setup

    if(def.dependencies === undefined || setup.forwards === undefined)
      return;

      // Add forward methods
    for(let s of setup.forwards){
      if(!s.server || !s.function){
        console.log("Missing server or function of forward")
        continue;
      }

      let server = null;
      for(let serv of setup.servers){
        if(serv.name == s.server){
          server = serv;
          break;
        }
      }

      if(server == null){
        console.log("Missing server for forward")
        break;
      }

      let chosenDep = null;
      for(let dep of def.dependencies){
        if(dep.name == s.function && ((dep.namespace === undefined || dep.namespace == "") || dep.namespace == server.namespace)){
          chosenDep = dep;
        }
      }

      if(chosenDep != null){
        if(this.handler[chosenDep.name] === undefined){
          this.addTranscendFunction(chosenDep.name)
        }

        this.functionDef[chosenDep.name.toLowerCase()] = chosenDep;
      }
    }
  }

  addTranscendFunction(functionName){
    this.handler[functionName] = async function(...args){
      if(this.mscp[functionName] !== undefined){
        return await this.mscp[functionName].apply(this.mscp, args)
      } else {
        return {error: "Not implemented"}
      }
    }
  }

  async handleRequest(apiPath, data, req, res){
    if(apiPath == ""){
      return this.getFullDefForClient()
    }

    let pathParts = apiPath.split("/")
    let namespace = ""
    let functionName = ""
    let fdef = null

    let def = this.definition.serve;

    // First look for explicit namespace
    if(pathParts.length > 0){
      for(let s of def){
        if(s.namespace == pathParts[0]){
          namespace = s.namespace
          pathParts.shift()
          break;
        }
      }

      // Then find function - first look for explicit function
      for(let s of def){
        if(s.name.toLowerCase() == pathParts[0].toLowerCase()){
          functionName = s.name
          pathParts.shift()
          break;
        }
      }
    }

    //Finally look for functions which are default for a HTTP method
    if(!functionName){
      for(let s of def){
        if(!s.default)
          continue

        if(namespace){
          if(!s.namespace || namespace.toLowerCase() != s.namespace.toLowerCase()){
            continue;
          }
        }
        if(s.default.toLowerCase() == req.method.toLowerCase()){
          functionName = s.name
          break;
        }
      }
    }

    if(functionName){
      if(namespace)
        fdef = this.functionDef[namespace.toLowerCase() + '.' + functionName.toLowerCase()]
      else
        fdef = this.functionDef[functionName.toLowerCase()]
    }

    if(fdef == null){
      return {error: "Unknown function " + functionName, functionName: functionName}
    }

    functionName = fdef.name; // name in the correct case (this.functionDef is lowercase)

    let args = [];

    let argNum = 0;
    for(let a of fdef.args){
      let val = null;
      let arg = typeof a === "string" ? {name: a} : a

      if(data[arg.name] !== undefined)
        val = data[arg.name]
      else if(pathParts.length > argNum && pathParts[argNum] != "null")
        val = pathParts[argNum]

      switch(a.type || "string"){
        case "string":
          val = typeof val === "string" ? val : null
          break;
        case "integer":
          val = typeof val === "number" ? parseInt(val) : (typeof val === "string" && !isNaN(val)) ? parseInt(val) : null
          break;
        case "float":
          val = typeof val === "number" ? parseFloat(val) : (typeof val === "string" && !isNaN(val)) ? parseFloat(val) : null
          break;
        case "boolean":
          val = typeof val === "boolean" ? val : val === "true" ? true : val === "false" ? false : null
          break;
        case "object":
          val = (typeof val === "object" && !Array.isArray(val)) ? val : null
          break;
        case "array":
          val = Array.isArray(val) ? val : null
          break;
      }

      if((val == null || val === undefined) && (a.required !== false && a.optional !== true))
        return {error: "Missing argument: " + a.name}

      args.push(val)
      argNum++
    }

    let result = null;
    try {
      let context = new (this.handlerClasses[namespace])()
      context.mscp = this.mscp
      context.definition = this.definition
      context.global = this.handlerGlobal
      context.request = {path: apiPath, data: data, req: req, res: res}

      if(typeof context.init === "function")
        await context.init()
      if(typeof context.validateAccess === "function" && (await context.validateAccess(namespace?namespace+"."+functionName:functionName)) !== true)
        return {success: false, error: "Access denied by handler"}

      if(namespace != "")
        result = await this.handler[namespace][functionName].apply(context, args);
      else
        result = await this.handler[functionName].apply(context, args);
    } catch (e) {
      console.log(e)
      return {
        success: false,
        error: typeof e === "string" ? e : "An unknown error occured in server function '" + functionName + "'",
        additionalInfo: e.stack ? e.stack.toString() : undefined
      }
    }

    if(typeof result === "object" && result != null && result.error){
      return {success: false, error: result.error, result: result}
    }

    let ret = {success: true, result: result !== undefined ? result : null}

    if(fdef.returntype == "download"){
      ret.type = "download"
      if(typeof result === "string"){
        ret.file = {path: result}
      } else if(typeof result === "object" && typeof result.path === "string"){
        ret.file = result
      }
    } else if(fdef.returntype == "custom"){
      ret.type = "custom"
    }

    return ret
  }
}

module.exports = Server
