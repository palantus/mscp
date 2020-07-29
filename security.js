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
    let ip = '';
    if(this.setup.trustProxy === true)
      ip = req.ip
    else if(this.setup.useForwardedHeader === true)
      ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    else if(this.setup.useRealIPHeader === true)
      ip = req.headers['x-real-ip'] || req.connection.remoteAddress;
    else
      ip = req.connection.remoteAddress;

    let data = this.mscp.server.extend({}, req.body||{}, req.query||{});

    let area = "static"
    if(req.path.startsWith("/mscp")){
      area = "manage"
    } else if(req.path.startsWith("/api")){
      area = "api"
    }

    let accessKey = data.accessKey

    let accessKeyCookieName = area == "api" ? "mscpAccessKeyAPI"
                            : area == "manage" ? "mscpAccessKeyManage"
                            : "mscpAccessKeyStatic";
    if(accessKey === undefined){
      accessKey = req.cookies[accessKeyCookieName];
    }

    if(accessKey !== undefined){
      if(this.setup.accessKeyExpirationDays){
        let today = new Date();
        res.cookie(accessKeyCookieName, accessKey, {expires: new Date(today.getFullYear(),today.getMonth(),today.getDate()+this.setup.accessKeyExpirationDays), httpOnly: false, sameSite: "None" });
      } else {
        res.cookie(accessKeyCookieName, accessKey, {expires: new Date(Date.now() + 1500000000), httpOnly: false, sameSite: "None" });
      }
    }

    req.mscp = {ip: ip, accessKey: accessKey, area: area}

    if(req.path.startsWith("/mscp/js/")
            || req.path.startsWith("/mscp/libs/")
            || req.path.startsWith("/mscp/apibrowser")
            || req.path.startsWith("/mscpui/static/")
            || req.path == "/api/browse" || req.path == "/api/browse/"
            || req.path == "/api" || req.path == "/api/")
    {
      next(); //Always allowed
    } else if(this.validate(req.path, data, area, ip, accessKey)){
      next()
    } else if(req.get("Accept") !== undefined && req.get("Accept").indexOf("text/html") >= 0){
      res.writeHead(200, "text/html");
      res.end(this.accessKeyPromptHTMLPage)
      console.log("Denied request for " + req.path + " from IP " + ip + (accessKey !== undefined ? " and access key \"" + accessKey + "\"" : ""))
    } else {
      res.writeHead(403);
      res.end("You do not have access to this content.")
      console.log("Denied request for " + req.path + " from IP " + ip + (accessKey !== undefined ? " and access key \"" + accessKey + "\"" : ""))
    }
  }

  validate(path, data, area, ip, accessKey){
    let scheme = area == "api" ? this.setup.api_access_scheme
               : area == "manage" ? this.setup.manage_access_scheme
               : area == "static" ? this.setup.static_access_scheme
               : "deny_all"

    switch(scheme){
      case "full_access":
        return true
      case "deny_all":
        return false
      case "localhost":
        return ip == "127.0.0.1" || ip == "::ffff:127.0.0.1" || ip == "::1"
      case "access_rule":
        return this.validateAccess(path, data, area, accessKey, ip)
      case undefined:
        return true
    }

    return false;

  }

  validateAccess(path, data, area, accessKey, ip){
    if(this.setup.accessRules === undefined)
      return false

    let matchesIP = false;
    let matchesKey = false;
    for(let f of this.setup.accessRules){
      if(f.area != area && f.area != "all")
        continue

      matchesIP = false;
      matchesKey = false;

      if(f.ip === undefined || f.ip == null || f.ip === ""){
        matchesIP = true;
      } else {
        try{
          if(new RegExp(f.ip).test(ip)){
            matchesIP = true;
          }
        } catch(err){
          console.log("Error validating IP " + ip + " against regexp \"" + f.ip + "\"");
          console.log(err)
        }
      }

      if(!matchesIP)
        continue;

      if(f.require_access_key !== true) {
        matchesKey = true;
      } else if(accessKey && f.accessKeys !== undefined && f.accessKeys.findIndex((ak) => ak.key == accessKey) >= 0){
        matchesKey = true;
      }

      if(matchesIP && matchesKey && this.validateSubRules(path, data, f)){
        return true;
      }
    }
    return false;
  }

  validateSubRules(path, data, accessRule){
    let subRules = accessRule.subRules || []
    for(let sr of subRules){

      if(sr.path.endsWith('*')){
        let p = sr.path.substring(0, sr.path.length - 1)
        if(!path.startsWith(p))
          continue;
      } else {
        if(path != sr.path && path != sr.path + "/")
          continue;
      }

      if(accessRule.default_permission == "allow" && sr.permission == "allow")
        continue;

      if(accessRule.default_permission == "deny" && sr.permission == "deny")
        continue;

      if(typeof sr.parameters === "string" && sr.parameters != ""){
        let parmsMatch = true;
        let vars = sr.parameters.split("\n")
        for(let v of vars){
          if(v == "")
            continue;

          let vsplits = v.split("=")
          if(vsplits.length == 1 && data[vsplits[0]] === undefined){
            //Doesn't have required parameter
            parmsMatch = false;
            break;
          }

          let varName = vsplits[0]
          let varVal = vsplits[1]

          if(varVal == "null" && data[varName] !== null){
            parmsMatch = false;
            break;
          }

          if(varVal == "undefined" && data[varName] !== undefined){
            parmsMatch = false;
            break;
          }

          if(data[varName] === undefined){
            parmsMatch = false;
            break;
          }

          if(varVal.startsWith("$")){
            try{
              if(!new RegExp(varVal.substring(1)).test(data[varName])){
                parmsMatch = false;
                break;
              }
            } catch(err){
              parmsMatch = false;
            }
          } else {
            if(varVal != data[varName]){
              parmsMatch = false;
              break;
            }
          }
        }

        if(!parmsMatch){
          continue;
        }
      }

      return sr.permission == "allow" ? true : false;
    }

    return accessRule.default_permission == "allow" ? true : false;
  }

}

module.exports = Security
