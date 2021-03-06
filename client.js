"use strict"

const request = require("request")
const fs = require("fs")
const ConnectionManager = require("./connectionmanager.js")
const EventEmitter = require('events')
const streams = require('memory-streams')
class FunctionReadyEventEmitter extends EventEmitter{}

class Client{

  constructor(definition, mscp){
    this.definition = definition
    this.mscp = mscp
    this.setupHandler = mscp.setupHandler
    this._initFromDefinition()
    mscp._request = _request;
    this.serverDefinitions = {}
    this.loadDefinitionsPromise = null;
    this.functionReadyEventEmitter = new FunctionReadyEventEmitter()
    this.functionReadyEventEmitter.on('newListener', (event) => this.onNewFunctionReadyListener(event))
  }

  _initFromDefinition(){
    let def = this.definition
    if(def.dependencies === undefined)
      return;

    for(let dep of def.dependencies){
      this.addDependency(dep)
    }
  }

  async init(){
    this.connectionManager = new ConnectionManager(this.mscp);
    await this.connectionManager.init();
    this.loadDefinitionsPromise = this.loadAllDefinitions();

    if(this.setupHandler.setup.forwards){
      await this.loadDefinitionsPromise;
      for(let fwd of this.setupHandler.setup.forwards){
        this.addForward(fwd)
      }
    }
  }

  async reload(){
    this.definition = this.mscp.definition;
    this._initFromDefinition();
    await this.init()
  }

  async loadAllDefinitions(){
    let promises = []
    let servers = this.setupHandler.setup.servers || []
    for(let server of servers){
      promises.push(this.setupHandler.getServerDefinition(server))
    }
    for(let i = 0; i < promises.length; i++){
      if(servers[i].id)
        this.addDefinition(servers[i].id, await promises[i])
    }

    return promises.length;
  }

  addDependency(dep){
    let self = this

    let obj = {}
    if(dep.namespace !== undefined && dep.namespace != ""){
      if(this.mscp[dep.namespace] === undefined)
        this.mscp[dep.namespace] = {}
      obj = this.mscp[dep.namespace]
    } else {
      obj = this.mscp
    }

    obj[dep.name] = async function(...args){
      let servers = self.setupHandler.setup.servers || []
      let serverDefinitions = self.serverDefinitions

      let data = {}
      let i = 0
      for(let i = 0; i < dep.args.length && i < args.length; i++){
        let a = dep.args[i]
        if(typeof a === "string"){
          data[a] = args[i] !== undefined ? args[i] : null
        } else if (typeof a === "object" && typeof a.name === "string" && a.name != ""){
          data[a.name] = args[i] !== undefined ? args[i] : null
        }
      }

      let chosenServer = null

      //Await initial load of definitions
      await self.loadDefinitionsPromise

      let d2s = self.setupHandler.setup.dependencyToServer || {}
      let setupServer = d2s[(dep.namespace?dep.namespace+".":"")+dep.name]

      if(setupServer && typeof setupServer.id === "string" && setupServer.id.length > 0){
        for(let s of servers){
          if(s.id == setupServer.id){
            chosenServer = s;
          }
        }
      } else {
        for(let s of servers){
          if(s.enabled === false)
            continue;

          if(s.id && ((!s.namespace && !dep.namespace) || s.namespace.toLowerCase() == dep.namespace.toLowerCase())){
            let def = serverDefinitions[s.id]
            if(def === undefined || def === null){
              await self.loadAllDefinitions()
              def = serverDefinitions[s.id]
              if(def === undefined || def === null){
                console.log("Could not get definition from " + s.name + " (" + s.id + "), which is needed for a call")
                continue;
              }
            }
            for(let ss of def.serve){
              if(ss.namespace && (!dep.namespace || ss.namespace.toLowerCase() != dep.namespace.toLowerCase()))
                continue;
              if(ss.name.toLowerCase() == dep.name.toLowerCase()){
                chosenServer = s;
                break;
              }
            }
          }
          if(chosenServer != null)
            break;
        }
      }

      if(chosenServer == null){
        let error = "Unable to find a server to satisfy a call to " + (dep.namespace?dep.namespace + ".":"") + dep.name;
        console.log("ERROR: " + error)
        return;
      }

      let pipeToRes = undefined;
      let res;
      if(dep.returntype === "download"){
        pipeToRes = new streams.WritableStream();
      }
      if(setupServer)
        res = await self.connectionManager.call(chosenServer, (setupServer.namespace?setupServer.namespace+'/':'') + setupServer.method, data, (chosenServer.accesskey ? chosenServer.accesskey : (chosenServer.forwardAccessKey === true ? this.request.req.mscp.accessKey : undefined)), pipeToRes)
      else
        res = await self.connectionManager.call(chosenServer, dep.name.replace(/\./g, '/'), data, (chosenServer.accesskey ? chosenServer.accesskey : (chosenServer.forwardAccessKey === true ? this.request.req.mscp.accessKey : undefined)), pipeToRes)

      return pipeToRes ? pipeToRes : res;
    }
  }

  async addForward(fwd){
    let server = this.setupHandler.setup.servers.find((s) => s.id == fwd.server || s.name == fwd.server);
    let fdef = await this.getForwardFunctionDef(fwd)
    if(!fdef)
      return;

    let obj = {}
    if(fdef.namespace !== undefined && fdef.namespace != ""){
      if(this.mscp[fdef.namespace] === undefined)
        this.mscp[fdef.namespace] = {}
      obj = this.mscp[fdef.namespace]
    } else {
      obj = this.mscp
    }

    if(obj[fdef.name] !== undefined){
      console.log(`ERROR: you cannot forward and depend on the same namespace and function name. Forward function "${fdef.name}" ignored.`)
      return;
    }

    obj[fdef.name] = async function(...args) {

        let data = {}
        for(let i = 0; i < fdef.args.length && i < args.length; i++){
          let a = fdef.args[i]
          if(typeof a === "string"){
            data[a] = args[i] !== undefined ? args[i] : null
          } else if (typeof a === "object" && typeof a.name === "string" && a.name != ""){
            data[a.name] = args[i] !== undefined ? args[i] : null
          }
        }

        if(server.type == "http"){

          if(this.request.req && this.request.req.files){
            // Handle file upload
            return await new Promise((resolve, reject) => {
                let url = server.url + "/api/" + (fwd.namespace?fwd.namespace+"/":"") + fwd.function + (server.accesskey ? "?accessKey=" + server.accesskey : (server.forwardAccessKey === true ? "?accessKey=" + this.request.req.mscp.accessKey : ""))
                let req = request.post(url);
                let form = req.form();

                for(let filedef in this.request.req.files){
                  let file = Array.isArray(this.request.req.files[filedef]) ? this.request.req.files[filedef] : [this.request.req.files[filedef]]
                  for(let f of file){
                    form.append('file', f.data, {
                      filename: f.name,
                      contentType: f.mimetype
                    });
                  }
                }

                req.pipe(this.request.res)
            })
          } else {
            return await this.mscp.client.connectionManager.call(server, (fwd.namespace?fwd.namespace+"/":"") + fwd.function, data, (server.accesskey ? server.accesskey : (server.forwardAccessKey === true ? this.request.req.mscp.accessKey : undefined)), this.request.res)
          }
        } else {
          return await this.mscp.client.connectionManager.call(server, (fwd.namespace?fwd.namespace+"/":"") + fwd.function, data, (server.accesskey ? server.accesskey : (server.forwardAccessKey === true ? this.request.req.mscp.accessKey : undefined)))
        }
    }
  }

  addDefinition(serverId, def){
    if(def == null)
      return;

    this.serverDefinitions[serverId] = def
    if(def.serve !== undefined){
      for(let s of def.serve){
        this.functionReadyEventEmitter.emit(s.name)
      }
    }
  }

  removeDefinition(serverId){
    this.serverDefinitions[serverId] = undefined;
  }

  functionReady(functionName){
    return new Promise((resolve, reject) => {
      this.functionReadyEventEmitter.once(functionName, resolve);
    })
  }

  onNewFunctionReadyListener(functionName){
    let servers = this.setupHandler.setup.servers || []
    for(let s of servers){
      let def = this.serverDefinitions[s.id]
      if(def !== undefined && def.serve !== undefined){
        for(let serv of def.serve){
          this.functionReadyEventEmitter.emit(serv.name)
        }
      }
    }
  }

  async getForwardFunctionDef(forward){
    await this.mscp.client.loadDefinitionsPromise;

    let server = this.setupHandler.setup.servers.find((s) => s.id == forward.server || s.name == forward.server);
    if(!server || server.enabled === false)
      return null;

    let serverDef = this.mscp.client.serverDefinitions[server.id];
    if(!serverDef)
      return null;

    let fdef = serverDef.serve.find((s) => (!s.namespace || s.namespace == forward.namespace) && s.name == forward.function);
    if(!fdef)
      return null;

    fdef = JSON.parse(JSON.stringify(fdef));
    fdef.namespace = server.namespace;
    return fdef;
  }
}

async function _request(_body, _pipeToRes){
  return new Promise((resolve, reject) => {
      if(_pipeToRes){
        // For some reason large files (>~200KB) doesn't result in finish being called. Seems like request bug:
        // https://github.com/request/request/issues/2905
        
        request(_body).pipe(_pipeToRes).on('finish', () => resolve(_pipeToRes))
      } else {
        let req = request(_body, (error, response, body) => {
            if(error || (response.statusCode >= 400 && response.statusCode < 600)) {
              console.log(`Request error: received status code ${response ? response.statusCode : "N/A"} when calling "${_body.url}". Error: ${error || body}`)
              reject(error || body)
            } else {
              resolve(body)
            }
        });
      }
  })
}

module.exports = Client
