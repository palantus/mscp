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
          this.connect(s).catch(() => true)
        } else if(s.type == "websocket-client"){
          this.connPromises[s.id] = {}
          this.connPromises[s.id].promise = new Promise((resolve, reject) => this.connPromises[s.id].resolve = resolve)
        }
      }
    }

    setInterval(() => this.tryReconnect(), 30000)
  }

  async tryReconnect(){
    if(this.mscp.setupHandler.setup.servers !== undefined){
      for(let s of this.mscp.setupHandler.setup.servers){
        if(s.type == "websocket-server" && s.url && !this.conns[s.id]){
          this.connect(s).then(() => console.log("Reconnected!")).catch(() => true)
        }
      }
    }
  }

  connect(server){
    if(this.connPromises[server.id] !== undefined){
      return this.connPromises[server.id]
    }

    this.connPromises[server.id] = new Promise((resolve, reject) => {
      let url = (server.url.startsWith("ws://") || server.url.startsWith("wss://")) ? server.url : "ws://" + server.url
      const ws = new WebSocket(url);

      ws.on('open', async () => {
        ws.serverId = server.id
        this.conns[server.id] = {server: server, ws: ws}
        this.connPromises[server.id] = undefined
        resolve()
        let def = await this.mscp.setupHandler.getServerDefinition(server)
        this.mscp.client.addDefinition(server.id, def)
      })

      ws.on('message', (data, flags) => this.handleMessage(server, data, ws))
      ws.on('close', () => {
        console.log("Connection to server " + server.id + " closed")
        this.connPromises[server.id] = undefined;
        this.mscp.client.removeDefinition(server.id)
        delete this.conns[server.id];
        setTimeout(() => this.tryReconnect(), 5000);
      })
      ws.on('error', (err) => {
        this.connPromises[server.id] = undefined;
        reject("Could not connect to " + server.name)
      })
    })
    return this.connPromises[server.id];
  }

  async onNewConnection(ws){
    ws.on('message', (message) => this.handleMessage(null, message, ws))
    ws.on('close', () => {
      if(ws.serverId){
        this.mscp.client.removeDefinition(ws.serverId)
        delete this.conns[ws.serverId];
      }
    })
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
      let reply = await this.mscp.server.handleRequest(msg.method, msg.data, {mscp: {ip: ws._socket.remoteAddress, accessKey: msg.accesskey, area: 'api'}});
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

  call(server, _method, _data, _accessKey){
    let data = _data !== undefined ? JSON.parse(JSON.stringify(_data)) : {}
    let method = JSON.parse(JSON.stringify(_method))

    return new Promise(async (resolve, reject) => {
      let accessKey = _accessKey ? _accessKey : server.accesskey
      if(server.type === "http"){
        if(saccessKey){
          if(Array.isArray(data))
            method += "?accessKey=" + accessKey
          else
            data.accessKey = accessKey;
        }
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
            try{
              await this.connect(server)
            } catch(err){
              reject(err);
              return;
            }
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
          accesskey: server.type == "websocket-server" ? accessKey : undefined,
          type: "call",
          method: method,
          data: data
        }));

        promise.then((response)=>{
          if(response.error !== undefined){
            console.log(`Error in calling method on server ${server.name}: ${response.error}`)
            reject(response.error);
          }
          resolve(method == "" ? response : response.result)
        })
      }
    })
  }
}

module.exports = ClientConnections
