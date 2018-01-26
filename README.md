# MSCP: MicroService Communication Platform

TBD!

## Sample server/client
```
const MSCP = require("mscp");
const Handler = require("./handler.js");
const path = require("path");

(async () => {
  let mscp = new MSCP(Handler)
  mscp.server.static(path.join(__dirname, 'www'));
  mscp.start();
})()
```

The handler constructor argument for MSCP can be either a single class (no namespaces) or an object. If it is an object, then it maps namespaces to handler classes. The root handler is "".

In your handler, you can access the context of the current reqest using the properties:
- this.mscp: reference to mscp class
- this.definition: reference to the definition.json file parsed as an object
- this.global: An empty object that is the same between requests
- this.request = An object containing path (url path of request), data (all url/post parameters) and req (express req object - has mscp.ip and mscp.accessKey)

## Sample browser client:

```
<script src="/mscp/js/browser.js"></script>
<script src="/mscp/js/jquery.min.js"></script>
<script>
$(function() {
  mscp.ready.then(myFunction)
});

async function myFunction(){
  let value = await mscp.getValue("123")
  console.log(value)
}
</script>
```

## Requirements

You need note 7+ and (if version < 8) the node flag ```--harmony-async-await```.
For the browser client, you need Chrome 56 or Firefox 52 (for async/await).

## Setup parameters

- trustProxy: Instructs Express to trust the proxy that sent the request. Only use, when you are behind a proxy that you trust.
- useForwardedHeader: If set to true, then the security module will check the headers for 'x-forwarded-for' header to get the IP of the client, instead of the proxy server. Only use this, if you are behind a proxy that sets this variable.
- useRealIPHeader: If set to true, then the security module will check the headers for 'x-real-ip' header to get the IP of the client, instead of the proxy server. Only use this, if you are behind a proxy that sets this variable.

## Sample simple UI


```
TBD
```

## Sample UI Setup, with a single function as entry:

```
{
  "apps": {
    "": {"title": "Starter", "items": ["services", "kill", "log"], "defaultIndex": 0, "showMenu": false}
  },
  "items": {
    "services": {
      "title":" List services",
      "autorun": true,
      "actions":{
        "<row>": [
          {"call": "log", "title": "View log", "args": {"name": "active.name"}},
          {"call": "setup", "title": "Show setup", "args": {"name": "active.name"}},
          {"call": "gitpull", "title": "Execute: git pull", "args": {"name": "active.name"}, "ui": "notify-result", "notifytimeout": 7000},
          {"call": "npminstall", "title": "Execute: npm install", "args": {"name": "active.name"}, "ui": "notify-result", "notifytimeout": 7000},
          {"call": "kill", "title": "Force stop", "args": {"name": "active.name"}, "ui": "notify-result"},
          {"call": "enableService", "title": "Enable", "args": {"name": "active.name"}, "ui": "notify-result"},
          {"call": "disableService", "title": "Disable", "args": {"name": "active.name"}, "ui": "notify-result"},
          {"type": "link", "url": "<curhostnoport>:<active.http_port>/mscp", "title": "Open: MSCP Setup"},
          {"type": "link", "url": "<curhostnoport>:<active.http_port>/api/browse", "title": "Open: API Browser"},
          {"type": "link", "url": "<curhostnoport>:<active.http_port>", "title": "Open: Root"}
        ],
        "": [
          {"type": "link", "item": "services", "title": "Refresh"}
        ]
      }
    },
    "log": {"title":"Get log"},
    "kill": {"title":"Restart service"}
  }
}
```

## Reserved URL parameters:
- accessKey: used when securing (som parts of) the server with access keys
- responseType: can be used to set response type to XML instead of JSON
