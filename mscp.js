"use strict"

var fs = require("fs")
var Server = require("./server.js")
var Client = require("./client.js")
var Setup = require("./setup.js")

//Run using --harmony-async-await on node version 7+

class MSCP{

  constructor(handler){
    this.handler = handler
    this.server = {uses: [], static: null}
    this.server.use = function(...args){
      this.uses.push(...args)
    }
    this.server.static = function(path){
      this.staticPath = path;
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
    this.setup = new Setup(this)
    this.setupHandler = this.setup

    await this._initDefinition()
    if(typeof this.definition !== "object"){
      throw "Missing definition"
    }

    if(this.handler === undefined)
      this.handler = {}

    this.handler.mscp = this

    if(typeof this.handler === "object"){
      this.handler.definition = this.definition
      this.server = new Server(this)
      await this.server.run(port)
    } else {
      console.log("Not starting server, as there aren't any handler")
    }

    this.client = new Client(this.definition, this);
    await this.client.init();

    this.mscpReadyResolve();
  }
}

module.exports = MSCP
