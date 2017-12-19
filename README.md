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
