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

//Run using --harmony-async-await on node version 7+

class Server{

  constructor(mscp){
    this.mscp = mscp
    this.definition = mscp.definition
    this.handler = mscp.handler
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
      app.use(bodyParser.urlencoded({ extended: true }))
      app.use(bodyParser.json())
      app.use(cookieParser());
      app.use(async (req, res, next) => await this.security.onRequest.call(this.security, req, res, next));
    }

    app.use(`${this.rootPath}api/browse`, express.static(path.join(__dirname, "www/apibrowser")))
    app.use(`${this.rootPath}api`, async (req, res) => await this.handleAPIRequest(req, res));
    app.use(`${this.rootPath}mscp/libs`, express.static(require("mscp-browserlibs")))
    app.use(`${this.rootPath}mscp`, express.static(path.join(__dirname, "www")))
    app.use(`${this.rootPath}mscpapi`, async (req, res) => await this.setupHandler.handleJSONRequest.call(this.setupHandler, req, res))

    for(let use of this.uses)
      app.use.apply(app, use)

    for(let s of this.statics)
      app.use(`${s.rootPath}`, express.static(s.wwwPath))

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
        if(contentType === undefined)
          res.writeHead(200, {'Content-Type':'application/json'});
        else
          res.writeHead(200, {'Content-Type': contentType});

        if(typeof result == "string")
          res.end(result);
        else if(typeof result == "object" && isBinary)
          res.end(result, 'binary')
        else
          res.end(JSON.stringify(result, null, 2));
      } else {
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error: "Invalid response. Server Error. ", apiPath: apiPath, data: data, baseUrl: req.baseUrl}, null, 2));
      }
    }

    var response = null;

    if(apiPath == ""){
      response = this.getFullDefForClient()
    } else
      response = await this.handleRequest(apiPath, data)

    if(typeof response === "object" && response.type == "response")
      respond(response.data, response.contentType, response.isBinary)
    else
      respond(response)
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
    let h = this.handler
    let def = this.definition

    this.functionDef = {}

    if(def.serve === undefined)
      def.serve = []

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

  async handleRequest(apiPath, data){
    if(apiPath == ""){
      return this.getFullDefForClient()
    }

    let pathParts = apiPath.split("/")
    let namespace = null;
    let functionName = pathParts.shift();
    let fdef = this.functionDef[functionName.toLowerCase()]
    if(fdef === undefined && pathParts.length > 0){
      namespace  = functionName
      functionName = pathParts.shift()
      fdef = this.functionDef[namespace.toLowerCase() + '.' + functionName.toLowerCase()]
    }
    if(fdef === undefined){
      return {error: "Unknown function " + functionName, functionName: functionName}
    }

    functionName = fdef.name; // name in the correct case (this.functionDef is lowercase)

    let args = [];

    let argNum = 0;
    for(let a of fdef.args){
      if(typeof a === "string"){
        if(data[a] !== undefined)
          args.push(data[a])
        else if(pathParts.length > argNum && pathParts[argNum] != "null")
          args.push(pathParts[argNum])
        else
          return {error: "Missing argument: " + a}
      } else if (typeof a === "object"){
        if(data[a.name] !== undefined)
          args.push(data[a.name])
        else if(pathParts.length > argNum && pathParts[argNum] != "null")
          args.push(pathParts[argNum])
        else if(a.required === false || a.optional === true)
          args.push(null)
        else
          return {error: "Missing argument: " + a.name}
      }
      argNum++
    }

    let result = null;
    try {
      if(namespace != null)
        result = await this.handler[namespace][functionName].apply(this.handler, args);
      else
        result = await this.handler[functionName].apply(this.handler, args);
    } catch (e) {
      console.log(e)
      return {
        success: false,
        error: typeof e === "string" ? e : "An unknown error occured in server function '" + functionName + "'",
        additionalInfo: e.stack.toString()
      }
    }

    if(typeof result === "object" && result != null && result.error){
      return {success: false, error: result.error, result: result}
    }

    return {success: true, result: result !== undefined ? result : null}
  }
}

module.exports = Server
