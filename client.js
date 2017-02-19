"use strict"

const request = require("request")
const fs = require("fs")
const ConnectionManager = require("./connectionmanager.js")
const EventEmitter = require('events')
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

      if(typeof dep.serverId === "string" && dep.serverId.length > 0){
        for(let s of servers){
          if(s.id == dep.serverId){
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
        throw error
      }

      return await self.connectionManager.call(chosenServer, dep.name, data)
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
}

async function _request(body){
  return new Promise((resolve, reject) => {
      request(body, (error, response, body) => {
          if(error) reject(error)
          else resolve(body)
      })
  })
}

module.exports = Client
