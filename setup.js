"use strict"

var url = require("url")
var fs = require("fs")
var uuid = require("node-uuid")

class Setup{

  constructor(mscp){
    this.mscp = mscp

    if(fs.existsSync("./setup.json"))
      this.setup = JSON.parse(fs.readFileSync("./setup.json", "utf-8"))
    else
      this.setup = {}
  }

  async handleJSONRequest(req, res){
    var data = req.body;
    if(data === undefined || (Object.keys(data).length === 0 && data.constructor === Object))
      data = req.query;

    if(data === undefined){
      res.end("Invalid request!");
      return;
    }

    var apiPath = url.parse(req.url).pathname.substring(1);
    let def = null;
    let serveName = null;
    let arg = null;

    res.writeHead(200, {'Content-Type':'application/json'});

    let response = undefined;
    switch(apiPath.toLowerCase()){


      /* SERVERS */
      case "add-server":
      case "refresh-server":
        if(!data.url.startsWith("http"))
          data.url = "http://" + data.url;

        switch(data.type){
          case "http":
          case "websocket-server":
            var definition = await this.getServerDefinition(data)
            if(definition != null){
              data.name = definition.name;
            }
            break;
          case "websocket-client":
            data.name = "Client";
        }

        if(this.setup.servers === undefined)
          this.setup.servers = []

        if(apiPath.toLowerCase() == "add-server"){
          data.id = uuid.v4()
          this.setup.servers.push(data)
        } else {
          for(let i = 0; i < this.setup.servers.length; i++){
            if(this.setup.servers[i].id === data.id){
              this.setup.servers[i] = data;
            }
          }
        }
        fs.writeFile("./setup.json", JSON.stringify(this.setup, null, 4), ()=>null)
        response = {}
        break;

      case "update-server":
        if(data.id !== undefined){
          for(let i = 0; i < this.setup.servers.length; i++){
            if(this.setup.servers[i].id === data.id){
              this.setup.servers[i].namespace = data.namespace;
              this.setup.servers[i].enabled = data.enabled;
              this.setup.servers[i].websocket = data.websocket;
            }
          }
          fs.writeFile("./setup.json", JSON.stringify(this.setup, null, 4), ()=>null)
        }
        break;

      case "get-servers":
        response = this.setup.servers
        break;

      case "get-server-definition":
        if(data.id !== undefined){
          var definition = await this.getServerDefinition(data)
          if(definition != null)
            response = definition
          else
            response = {error: "Could not get definition from server"}
        }
        break;

      case "get-servers-with-status":
        let serverStatus = []
        let promises = []
        if(this.setup.servers !== undefined){
          for(let i = 0; i < this.setup.servers.length; i++){
            promises.push(new Promise(async (r) => {
              var definition = await this.getServerDefinition(this.setup.servers[i])
              r(definition)
            }))
          }

          for(let i = 0; i < promises.length; i++){
            let definition = await promises[i];
            serverStatus[i] = JSON.parse(JSON.stringify(this.setup.servers[i]));
            serverStatus[i].running = definition != null && definition["name"] !== undefined;
          }
        }

        response = serverStatus
        break;

      case "log":
        response = []
        break;

      case "remove-server":
        if(data.id !== undefined){
          for(let i = 0; i < this.setup.servers.length; i++){
            if(this.setup.servers[i].id === data.id){
              this.setup.servers.splice(i, 1)
              fs.writeFile("./setup.json", JSON.stringify(this.setup, null, 4), ()=>null)
            }
          }
        }
        response = {}
        break;


      /* DEPENDENCIES */
      case "get-dependencies":
        def = await this.readDefinition()
        let deps = def.dependencies !== undefined ? def.dependencies : []
        for(let d of deps){
          for(let i = 0; i < this.setup.servers.length; i++){
            if(this.setup.servers[i].id === d.serverId){
              d.serverName = this.setup.servers[i].name
            }
          }
        }
        response = deps
        break;

      case "remove-dependency":
        if(data && typeof data.name !== undefined && data.name != ""){
          def = await this.readDefinition()
          let deps = def.dependencies !== undefined ? def.dependencies : []
          for(let i = 0; i < deps.length; i++){
            if(deps[i].name == data.name){
              deps.splice(i, 1)
            }
          }
          def.dependencies = deps;
          await this.writeDefinition(def);
        }
        break;

      case "update-dependency":
        if(data && typeof data.name !== undefined && data.name != ""){
          def = await this.readDefinition()
          let deps = def.dependencies !== undefined ? def.dependencies : []
          for(let i = 0; i < deps.length; i++){
            if(deps[i].name == data.name){
              deps[i].namespace = data.namespace
            }
          }
          def.dependencies = deps;
          await this.writeDefinition(def);
        }
        break;

      case "add-all-server-func-as-dep":
        response = {error: "Not implemented"}
        break;

      case "add-server-func-as-dep":
        if(data && typeof data.name !== undefined && data.name != ""){
          def = await this.readDefinition()
          let deps = def.dependencies !== undefined ? def.dependencies : []
          let alreadyExists = false
          for(let i = 0; i < deps.length; i++){
            if(deps[i].name == data.name && deps[i].namespace == data.namespace){
              deps[i] = data;
              alreadyExists = true;
            }
          }
          if(!alreadyExists){
            deps.push(data);
          }
          def.dependencies = deps;
          await this.writeDefinition(def);
        }
        break;

      /* BASIC */
      case "set-basic-info":
        def = await this.readDefinition()

        if(typeof data.name === "string" && data.name !== "" && data.name != def.name){
          def.name = data.name
          await this.writeDefinition(def);
        }

        if(typeof data.http_port === "string" || typeof data.http_port === "number"){
          let port = parseInt(data.http_port)
          if(port > 0 && port <= 65535 && port != this.setup.http_port){
            this.setup.http_port = port
          }
        }

        if(typeof data.https_port === "string" || typeof data.https_port === "number"){
          let port = parseInt(data.https_port)
          if(port > 0 && port <= 65535 && port != this.setup.https_port){
            this.setup.https_port = port
          }
        }

        if(typeof data.enableHTTP === "boolean")
          this.setup.enableHTTP = data.enableHTTP

        if(typeof data.enableHTTPS === "boolean")
          this.setup.enableHTTPS = data.enableHTTPS

        if(typeof data.https_key === "string")
          this.setup.https_key = data.https_key

        if(typeof data.https_cert === "string")
          this.setup.https_cert = data.https_cert

        if(typeof data.https_ca === "string")
          this.setup.https_ca = data.https_ca

        if(typeof data.api_access_scheme === "string")
          this.setup.api_access_scheme = data.api_access_scheme

        if(typeof data.manage_access_scheme === "string")
          this.setup.manage_access_scheme = data.manage_access_scheme

        if(typeof data.static_access_scheme === "string")
          this.setup.static_access_scheme = data.static_access_scheme

        await this.writeSetup()

        response = {}
        break;

      case "get-basic-info":
        def = await this.readDefinition()
        response = {
          name: def.name,
          http_port: this.setup.http_port || this.setup.port || 8080,
          https_port: this.setup.https_port || 443,
          enableHTTP: this.setup.enableHTTP || true,
          enableHTTPS: this.setup.enableHTTPS || false,
          https_key: this.setup.https_key || "",
          https_cert: this.setup.https_cert || "",
          https_ca: this.setup.https_ca || "",
          api_access_scheme: this.setup.api_access_scheme || "full_access",
          manage_access_scheme: this.setup.manage_access_scheme || "full_access",
          static_access_scheme: this.setup.static_access_scheme || "full_access"
        }
        break;



      /* SERVE */
      case "get-serve":
        def = await this.readDefinition()
        response = def.serve !== undefined ? def.serve : []
        break;

      case "add-serve":
        if(data && typeof data.name !== undefined && data.name != ""){
          if(data.args === undefined)
            data.args = []

          def = await this.readDefinition()
          let serve = def.serve !== undefined ? def.serve : []
          let alreadyExists = false
          for(let i = 0; i < serve.length; i++){
            if(serve[i].name == data.name){
              serve[i] = data;
              alreadyExists = true;
            }
          }
          if(!alreadyExists){
            serve.push(data);
          }
          def.serve = serve;
          await this.writeDefinition(def);
        }
        break;

      case "remove-serve":
        if(data && typeof data.name !== undefined && data.name != ""){
          def = await this.readDefinition()
          let serve = def.serve !== undefined ? def.serve : []
          for(let i = 0; i < serve.length; i++){
            if(serve[i].name == data.name){
              serve.splice(i, 1)
            }
          }
          def.serve = serve;
          await this.writeDefinition(def);
        }
        break;

      case "update-serve":
        if(data && typeof data.name !== undefined && data.name != ""){
          def = await this.readDefinition()
          let serve = def.serve !== undefined ? def.serve : []
          for(let i = 0; i < serve.length; i++){
            if(serve[i].name == data.name || serve[i].name == data.oldName){
              serve[i].name = data.name;
              serve[i].title = data.title;
              serve[i].description = data.description;
              serve[i].returntype = data.returntype;
            }
          }
          def.serve = serve;
          await this.writeDefinition(def);
        }
        break;



      /* SERVE ARGUMENTS */
      case "get-serve-arguments":
        def = await this.readDefinition()
        if(def.serve !== undefined){
          for(let f of def.serve){
            if(f.name == data.name){
              response = f.args != undefined ? f.args : []
            }
          }
        } else {
          response = []
        }
        break;

      case "add-serve-argument":
        serveName = data.servename
        arg = data.record
        if(arg && typeof arg.name !== undefined && arg.name != ""){
          def = await this.readDefinition()
          let serve = def.serve !== undefined ? def.serve : []
          let alreadyExists = false
          for(let i = 0; i < serve.length; i++){
            if(serve[i].name == serveName){
              if(serve[i].args === undefined)
                serve[i].args = [];

              for(let a = 0; a < serve[i].args.length; a++){
                if(typeof serve[i].args[a] === "string")
                  serve[i].args[a] = {name: serve[i].args[a]};

                if(serve[i].args[a].name == arg.name)
                  alreadyExists = true;
              }
              if(!alreadyExists){
                serve[i].args.push(arg);
              }
            }
          }
          def.serve = serve;
          await this.writeDefinition(def);
        }
        break;

      case "remove-serve-argument":
        serveName = data.servename
        arg = data.record
        if(arg && typeof arg.name !== undefined && arg.name != ""){
          def = await this.readDefinition()
          let serve = def.serve !== undefined ? def.serve : []
          let alreadyExists = false
          for(let i = 0; i < serve.length; i++){
            if(serve[i].name == serveName && serve[i].args !== undefined){
              for(let a = 0; a < serve[i].args.length; a++){
                if(typeof serve[i].args[a] === "string")
                  serve[i].args[a] = {name: serve[i].args[a]};

                if(serve[i].args[a].name == arg.name)
                  serve[i].args.splice(a, 1)
              }
            }
          }
          def.serve = serve;
          await this.writeDefinition(def);
        }
        break;

      case "update-serve-argument":
        serveName = data.servename
        arg = data.record
        if(arg && typeof arg.name !== undefined && arg.name != ""){
          def = await this.readDefinition()
          let serve = def.serve !== undefined ? def.serve : []
          let alreadyExists = false
          for(let i = 0; i < serve.length; i++){
            if(serve[i].name == serveName && serve[i].args !== undefined){
              for(let a = 0; a < serve[i].args.length; a++){
                if(serve[i].args[a].name == arg.name || serve[i].args[a].name == arg.oldName){
                  serve[i].args[a].name = arg.name;
                  serve[i].args[a].title = arg.title;
                  serve[i].args[a].type = arg.type;
                  serve[i].args[a].required = arg.required;
                  serve[i].args[a].description = arg.description;
                }
              }
            }
          }
          def.serve = serve;
          await this.writeDefinition(def);
        }
        break;



      /* FORWARDS */
      case "get-forwards":
        response = this.setup.forwards !== undefined ? this.setup.forwards : []
        break;

      case "add-forward":
        if(data && data.server !== undefined && data.server != "" && data.function !== undefined && data.function != ""){
          if(this.setup.forwards === undefined)
            this.setup.forwards = []

          let alreadyExists = false
          for(let i = 0; i < this.setup.forwards.length; i++){
            if(this.setup.forwards[i].server == data.server && this.setup.forwards[i].function == data.function){
              alreadyExists = true;
              break;
            }
          }
          if(!alreadyExists){
            this.setup.forwards.push(data);
          }
          await this.writeSetup()
        }
        break;

      case "remove-forward":
        if(data && data.server !== undefined && data.server != "" && data.function !== undefined && data.function != ""){
          for(let i = 0; i < this.setup.forwards.length; i++){
            if(this.setup.forwards[i].server == data.server && this.setup.forwards[i].function == data.function){
              this.setup.forwards.splice(i, 1)
            }
          }
          await this.writeSetup()
        }
        break;



      /* SECURITY */
      case "get-access-rules":
        response = this.setup.accessRules || []
        break;
      case "add-access-rule":
        data.id = uuid.v4()
        if(data.type == "key" && data.filter == "")
          data.filter = uuid.v4()

        if(this.setup.accessRules === undefined)
          this.setup.accessRules = []

        this.setup.accessRules.push(data)
        fs.writeFile("./setup.json", JSON.stringify(this.setup, null, 4), ()=>null)
        response = {}
        break;
      case "remove-access-rule":
        for(let i = 0; i < this.setup.accessRules.length; i++){
          if(this.setup.accessRules[i].id === data.id){
            this.setup.accessRules.splice(i, 1);
          }
        }
        fs.writeFile("./setup.json", JSON.stringify(this.setup, null, 4), ()=>null)
        response = {}
        break;

      case "get-access-sub-rules":
        for(let a of this.setup.accessRules){
          if(a.id == data.accessId){
            response = a.subRules || [];
            break;
          }
        }
        break;

      case "add-access-sub-rule":
        data.id = uuid.v4()
        for(let a of this.setup.accessRules){
          if(a.id == data.accessId){
            if(a.subRules === undefined)
              a.subRules = []
            a.subRules.push(data.rule)
            break;
          }
        }

        fs.writeFile("./setup.json", JSON.stringify(this.setup, null, 4), ()=>null)
        response = {}
        break;

      case "remove-access-sub-rule":
        for(let a of this.setup.accessRules){
          if(a.id == data.accessId){
            if(a.subRules === undefined)
              a.subRules = []

            for(let i = 0; i < a.subRules.length; i++){
              if(a.subRules[i].id == data.ruleId){
                a.subRules.splice(i, 1)
                break;
              }
            }
            break;
          }
        }
        fs.writeFile("./setup.json", JSON.stringify(this.setup, null, 4), ()=>null)
        response = {}
        break;


      /* Forward setup to remote server */
      case "forward-to-server":
        if(data.server !== undefined && data.command !== undefined){
          let url = null;
          for(let i = 0; i < this.setup.servers.length; i++){
            if(this.setup.servers[i].id === data.server){
              url = this.setup.servers[i].url;
              break;
            }
          }
          if(url !== null){
            response = (await this.mscp._request({
              url: url + "/mscpapi/" + data.command,
              method: "POST",
              headers: {
                  "content-type": "application/json",
              },
              json: data.data
            }))
            response = JSON.parse(response)
          } else {
            response = {error: "Unknown server ID"}
          }
        } else {
          response = {error: "Invalid arguments"}
        }
        break;

      default:
        res.end(JSON.stringify({error: "Unknown setup API", path: apiPath}));
    }
    res.end(JSON.stringify(response != undefined ? response : {error: "Unknown server error", path: apiPath}));
  }

  async getServerDefinition(server){
    try{
      return await this.mscp.client.connectionManager.call(server, "")
    } catch(err){}
    return null;
  }
  async readDefinition(){
    try
    {
      return JSON.parse(await new Promise(r => fs.readFile("./definition.json", "utf-8", (err, data)=>r(data))))
    } catch(err){}
    return {}
  }
  async writeDefinition(def){
    try
    {
      await new Promise(r => fs.writeFile("./definition.json", JSON.stringify(def, null, 4), (err)=>r()));
    } catch(err){}
  }
  async writeSetup(def){
    try
    {
      await new Promise(r => fs.writeFile("./setup.json", JSON.stringify(this.setup, null, 4), (err)=>r()));
    } catch(err){}
  }

}

module.exports = Setup
