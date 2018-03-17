"use strict"

const WebSocket = require('ws')
const uuid = require("node-uuid")


class ClientConnections{
  constructor(mscp){
    this.mscp = mscp
    this.conns = {}
    this.replyPromises = {}
    this.accessKeyToServerId = {}
    this.connPromises = {}
  }

  async init(){
    if(this.mscp.setupHandler.setup.servers !== undefined){
      for(let s of this.mscp.setupHandler.setup.servers){
        if(s.type == "websocket-server" && s.url){
          this.connect(s)
        } else if(s.type == "websocket-client"){
          this.connPromises[s.id] = {}
          this.connPromises[s.id].promise = new Promise((resolve, reject) => this.connPromises[s.id].resolve = resolve)
        }
      }
    }
  }

  connect(server){
    if(this.connPromises[server.id] !== undefined){
      return this.connPromises[server.id]
    }

    this.connPromises[server.id] = new Promise((resolve, reject) => {
      let url = server.url.startsWith("ws://") ? server.url : "ws://" + server.url
      const ws = new WebSocket(url);

      ws.on('open', () => {
        ws.serverId = server.id
        this.conns[server.id] = {server: server, ws: ws}
        this.connPromises[server.id] = undefined
        resolve()
      })

      ws.on('message', (data, flags) => this.handleMessage(server, data, ws))
      ws.on('close', () => this.onConnectionClosed(ws))
    })
    return this.connPromises[server.id];
  }

  async onConnectionClosed(ws){
    if(ws.serverId !== undefined){
      this.mscp.client.removeDefinition(ws.serverId)
      this.conns[ws.serverId] = undefined
    }
  }

  async onNewConnection(ws){
    ws.on('message', (message) => this.handleMessage(null, message, ws))
    ws.on('close', () => this.onConnectionClosed(ws))
  }

  async handleMessage(server, message, ws){
    let msg = JSON.parse(message)

    if(server == null){
      if(this.mscp.setupHandler.setup.servers !== undefined && typeof msg.accesskey === "string" && msg.accesskey.length > 0){
        let serverId = this.accessKeyToServerId[msg.accesskey]
        if(serverId !== undefined && this.conns[serverId] !== undefined){
          server = this.conns[serverId].server
        } else {
          for(let s of this.mscp.setupHandler.setup.servers){
            if(s.type == "websocket-client" && s.accesskey == msg.accesskey){
              this.conns[s.id] = {server: s, ws: ws}
              this.accessKeyToServerId[msg.accesskey] = s.id
              this.connPromises[s.id].resolve()
              server = s
              ws.serverId = server.id;
              let def = await this.mscp.setupHandler.getServerDefinition(server)
              this.mscp.client.addDefinition(server.id, def)
              break;
            }
          }
        }
      } else {
        ws.close()
        return;
      }
    }

    if(server == null)
      return;

    if(msg.type == "call" && typeof msg.id === "string"){
      let reply = await this.mscp.server.handleRequest(msg.method, msg.data);
      if(this.conns[server.id] === undefined){
        await this.connect(server)
      }
      this.conns[server.id].ws.send(JSON.stringify({
        id: msg.id,
        type: "reply",
        accesskey: server.type == "websocket-server" ? server.accesskey : undefined,
        reply: reply
      }));
    } else if(msg.type == "reply"){
      if(this.replyPromises[msg.id] !== undefined){
        this.replyPromises[msg.id].resolve(msg.reply)
      }
    }
  }

  call(server, method, _data){
    var data = _data !== undefined ? _data : {}
    return new Promise(async (resolve, reject) => {
      if(server.type === "http"){
        let response;
        try{
          response = (await this.mscp._request({
            url: server.url + "/api/" + method,
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            json: data
          }))
        } catch(err){
          console.log("Error in calling dependency '" + method + "': " + err)
          reject(err);
          return;
        }

        //response = SON.parse(response)
        if(response.error !== undefined){
          console.log("Error in calling dependency '" + method + "': " + response.error)
          reject(response.error);
        }
        resolve(method == "" ? response : response.result)
      } else {
        if(this.conns[server.id] === undefined){
          if(server.type == "websocket-server"){
            await this.connect(server)
          } else {
            reject("Not connected");
            return;
          }
        }

        let id = uuid.v4()

        let promise = new Promise(function (resolve, reject) {
          this.replyPromises[id] = {resolve: resolve}
        }.bind(this))
        this.replyPromises[id].promise = promise;

        this.conns[server.id].ws.send(JSON.stringify({
          id: id,
          accesskey: server.type == "websocket-server" ? server.accesskey : undefined,
          type: "call",
          method: method,
          data: data
        }));

        promise.then((response)=>{
          if(response.error !== undefined){
            console.log("Error in calling dependency '" + (typeof dep === "string" ? dep : dep.name) + "': " + response.error)
            reject(response.error);
          }
          resolve(method == "" ? response : response.result)
        })
      }
    })
  }
}

module.exports = ClientConnections
