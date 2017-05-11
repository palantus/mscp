let remoteConfigServerName = getUrlVar("remoteServer");

 $(function() {
   if(remoteConfigServerName !== undefined){
     $("#important-info").html("Configuring remote server. Press <a href=\"/mscp\">here</a> to go back.</a>").show();
   }

   $("#tabremotebtn").click(function(){
     $(".tabcontent").hide();
     $("#remotecontent").show();
   })

   $("#tabdepbtn").click(function(){
     $(".tabcontent").hide();
     $("#depcontent").show();
   })

   $("#tabservebtn").click(function(){
     $(".tabcontent").hide();
     $("#servecontent").show();
   })

   $("#tabmiscbtn").click(function(){
     $(".tabcontent").hide();
     $("#misccontent").show();
   })

   $("#tabforwardbtn").click(function(){
     $(".tabcontent").hide();
     $("#forwardcontent").show();
   })

   $("#tabsecuritybtn").click(function(){
     $(".tabcontent").hide();
     $("#securitycontent").show();
   })

   $("#misccontent").show();
 });

function formatFunctionArgsAsString(args){
  if(args === undefined)
    return "";

  let ret = ""
  let first = true;
  for(let a of args){
    ret += (!first ? "<br/>" : "") + "<span class=\"argname\">" + (typeof a === "string" ? a : a.name) + "</span>";
    ret += "<span class=\"argtype\">" + ((a.type !== undefined && a.type != "") ? a.type : "*") + "</span>";
    ret += "<span class=\"argrequired\">" + (a.required === false ? " optional" : " required") + "</span>";
    first = false;
  }
  return ret;
}

async function req(_command, _data){
  let command = _command;
  let data = _data;

  if(remoteConfigServerName !== undefined){
    command = "forward-to-server";
    data = {server: remoteConfigServerName, command: _command, data: _data}
  }

  return fetch('/mscpapi/' + command, {
    method: 'post',
    body: JSON.stringify(data),
    credentials: 'include',
    headers: new Headers({
      'Content-Type': 'application/json'
    })
  });
}

var dataTypesForSelect = ["string", "integer", "float", "boolean", "object", "array", "download", "custom", "*"];

function getUrlVar( name ){
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( window.location.href );
    if( results == null )
        return undefined;
    else
        return decodeURIComponent(results[1]);
}

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1);
};

function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
}
