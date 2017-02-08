"use strict"

const path = require("path");
const fs = require("fs");

class Security{
  constructor(mscp){
    this.mscp = mscp
    this.cachedIPResult = {}
    this.cachedAccessKeyResult = {}
    this.accessKeyPromptHTMLPage = fs.readFileSync(path.join(__dirname, '/www/accesskeyprompt.html'))
  }

  async init(){
    this.setup = this.mscp.setupHandler.setup
  }

  async onRequest(req, res, next){
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    var data = req.body;
    if(data === undefined || (Object.keys(data).length === 0 && data.constructor === Object))
      data = req.query;

    let area = "api"
    if(req.path.startsWith("/mscp")){
      area = "manage"
    }

    let accessKey = data.accessKey

    let accessKeyCookieName = area == "api" ? "mscpAccessKeyAPI" : "mscpAccessKeyManage";
    if(accessKey === undefined){
      accessKey = req.cookies[accessKeyCookieName];
    }

    if(accessKey !== undefined){
      res.cookie(accessKeyCookieName, accessKey, {httpOnly: false });
    }

    if(this.validate(area, ip, accessKey)){
      next()
    } else if(req.get("Accept").indexOf("text/html") >= 0){
      res.writeHead(200, "text/html");
      res.end(this.accessKeyPromptHTMLPage)
      console.log("Denied request for area " + area + " from IP " + ip + " and access key \"" + accessKey + "\"")
    } else {
      res.writeHead(403);
      res.end("You do not have access to this content.")
      console.log("Denied request for area " + area + " from IP " + ip + " and access key \"" + accessKey + "\"")
    }
  }

  validate(area, ip, accessKey){
    let scheme = area == "api" ? this.setup.api_access_scheme
               : area == "manage" ? this.setup.manage_access_scheme
               : "deny_all"

    switch(scheme){
      case "full_access":
        return true
      case "deny_all":
        return false
      case "localhost":
        return ip == "127.0.0.1" || ip == "::ffff:127.0.0.1"
      case "access_key":
        return this.validateAccessKey(area, accessKey)
      case "ip_filter":
        return this.validateIP(area, ip)
      case "access_key_and_ip_filter":
        return this.validateAccessKey(area, accessKey) && this.validateIP(area, ip)
      case undefined:
        return true
    }

    return false;

  }

  validateIP(area, ip){
    if(this.setup.ipFilters === undefined)
      return false

    for(let f of this.setup.ipFilters){
      if(f.area != area)
        continue

      if(f.filter === undefined || f.filter == null || f.filter === ""){
        return true;
      } else {
        try{
          if(new RegExp(f.filter).test(ip)){
            return true
          }
        } catch(err){
          console.log("Error validating IP " + ip + " against regexp \"" + f.filter + "\"");
          console.log(err)
        }
      }
    }
    return false;
  }

  validateAccessKey(area, accessKey){
    if(this.setup.accessKeys === undefined)
      return false

    for(let f of this.setup.accessKeys){
      if(f.area != area)
        continue

      if(f.accessKey !== "" && f.accessKey == accessKey){
        return true;
      }
    }
    return false;
  }

}

module.exports = Security
