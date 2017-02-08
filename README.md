# MSCP: MicroService Communication Platform

TBD!

## Sample server/client
```
const MSCP = require("mscp");
const Handler = require("./handler.js");
const path = require("path");

(async () => {
  let mscp = new MSCP(new Handler())
  mscp.server.static(path.join(__dirname, 'www'));
  mscp.start();
})()
```

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

You need note 7+ and (if version < 8) the flag node ```--harmony-async-await main```.
