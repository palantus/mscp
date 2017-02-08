"use strict"

class MSCP{
  async init(){
    this.def = await req("")

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
    this[s.name] = async function(...args){
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

      var response = await req(s.name, data);
      if(response.success === true)
        return response.result;
      else {
        console.log("Error on calling function " + s.name + ": " + response.error)
        throw response.error;
      }
    }
  }
}

async function req(command, data = {}){
  try{
    let response = await fetch('/api/' + command, {
      method: 'post',
      body: JSON.stringify(data),
      credentials: 'include',
      headers: new Headers({
        'Content-Type': 'application/json'
      })
    });
    return await response.json();
  } catch(err){
    console.log(err)
    return {success: false, error: "Could not connect to server or received invalid response"};
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
