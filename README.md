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
