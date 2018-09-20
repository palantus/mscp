"use strict"

class MSCP{
  async init(apiPath){
    this.apiPath = apiPath ? apiPath : typeof MSCP_API_PATH === "string" ? MSCP_API_PATH : '/api'
    this.def = await this.apireq("")
    this.mscp_request_include_always_parms = {}

    if(this.def.error !== undefined && localStorage.MSCPDefinition !== undefined){
      this.def = JSON.parse(localStorage.MSCPDefinition)
      console.log("Could not fetch MSCP definition, so the one from localStorage is used")
    }

    if(this.def.error === undefined){
      for(let s of this.def.serve){
        this._addDependency(s)
      }
      localStorage.MSCPDefinition = JSON.stringify(this.def);
      return true;
    }

    console.log("Could not get any MSCP definition. Client calls will fail!")
    return false;
  }

  _addDependency(s){
    let obj = this;
    let objKey = s.name;
    if(s.namespace){
      if(this[s.namespace] === undefined){
        this[s.namespace] = {}
      }
      objKey = `${s.namespace}.${s.name}`
      this[s.namespace][s.name] = (...args) => this[objKey].apply(this, args);
    }

    this[objKey] = async function(...args){
      let data = {}
      let i = 0
      for(let i = 0; i < s.args.length && i < args.length; i++){
        let a = s.args[i]
        if(typeof a === "string"){
          data[a] = args[i] !== undefined ? args[i] : null
        } else if (typeof a === "object" && typeof a.name === "string" && a.name != ""){
          data[a.name] = args[i] !== undefined ? args[i] : null
        }
      }

      let command = (s.namespace ? s.namespace + "/" : "") + s.name;

      if(s.returntype == "download"){
        let args = []
        for(let a in data){
          args.push(`${a}=${data[a]}`)
        }
        window.location = `${this.apiPath}/${command}?${args.join("&")}`
        return;
      }

      var response = await this.apireq(command, data);
      if(response.success === true)
        return response.result;
      else {
        console.log("Error on calling function " + s.name + ": " + response.error)
        throw response.error;
      }
    }
  }

  async apireq(command, data = {}){
    return this.req(`${this.apiPath}/${command}`, data);
  }

  async req(url, data = {}){
    let reqData = jQuery.extend({}, data, this.mscp_request_include_always_parms);
    try{
      let response = await fetch(url, {
        method: 'post',
        body: JSON.stringify(reqData),
        credentials: 'include',
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      });
      if(response.status == 403){
        let accessKey = prompt("You do not have access to this functionality. Enter an access key to continue.")
        if(accessKey){
          reqData.accessKey = accessKey;
          return await this.req(url, reqData)
        } else {
          throw "No AccessKey entered"
        }
      }
      return await response.json();
    } catch(err){
      console.log(err)
      return {success: false, error: "Could not connect to server or received invalid response"};
    }
  }
}


var mscp = new MSCP();
mscp.ready = new Promise((resolve, reject)=>{mscp.readyResolve = resolve})
$(function() {
  (async () => {
    await mscp.init();
    mscp.readyResolve();
  })()
});
