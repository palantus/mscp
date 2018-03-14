"use strict"

var fs = require("fs")
var Server = require("./server.js")
var Client = require("./client.js")
var Setup = require("./setup.js")

//Run using --harmony-async-await on node version 7+

class MSCP{

  constructor(handlerClass){
    this.server = {uses: [], statics: [], handlerClass: handlerClass}
    this.server.use = function(...args){
      this.uses.push(args)
    }
    this.server.static = function(wwwPath, rootPath){
      this.statics.push({wwwPath: wwwPath, rootPath: rootPath || ""})
    }
    this.server.addParentMSCP = function(mscp, rootPath){
      this.parentMSCP = mscp
      this.rootPath = rootPath.endsWith("/") ? rootPath : (rootPath + "/")
    }
    this.mscpReady = new Promise((resolve) => this.mscpReadyResolve = resolve);

    if(typeof process.send === "function"){
      this.mscpReady.then(()=> process.send("mscp-is-ready"))
    }
  }

  async _initDefinition(){
    const defFile = await new Promise(r => fs.readFile("./definition.json", "utf-8", (err, data)=>r(data)));
    this.definition = JSON.parse(defFile || "{}")
  }

  async start(port){
    this.setupHandler = new Setup(this)

    await this._initDefinition()
    if(typeof this.definition !== "object"){
      throw "Missing definition"
    }

    this.client = new Client(this.definition, this);
    await this.client.init();

    if(typeof this.server.handlerClass !== undefined){
      this.server = new Server(this)
      await this.server.run(port)
    } else {
      console.log("Not starting server, as there aren't any handler")
    }

    this.mscpReadyResolve();

    process.on("message", async (m) => {
      if(m == "reload"){
        console.log("Reloading...")
        await this._initDefinition();
        await this.setupHandler.reload();
        await this.client.reload();
        await this.server.reload();
        console.log("Finished reloading")
      }
    })
  }
}

module.exports = MSCP
