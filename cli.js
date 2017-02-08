#!/usr/bin/env node

var program = require('commander');

program
 .arguments('<file>')
 .option('-p, --port <port>', 'The port to listen on')
 .parse(process.argv);

const MSCP = require("./mscp.js");

let mscp = new MSCP({})
mscp.start(program.port || 8080);
