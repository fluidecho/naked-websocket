"use strict";
//
// naked-websocket: benchmark sub
//
// Version: 0.0.1
// Author: Mark W. B. Ashcroft (mark [at] fluidecho [dot] com)
// License: MIT or Apache 2.0.
//
// Copyright (c) 2015 Mark W. B. Ashcroft.
// Copyright (c) 2015 FluidEcho.
//


var preview = require('preview')('socket_sub');
var humanize = require('humanize-number');
var argv = require('minimist')(process.argv.slice(2));
var nws = require('..');


var options = {
  protocol: 'ws',         // or 'wss' for secure.
  hostname: '127.0.0.1',
  port: 8080,
  path: '/foo/bar/?_protocol=amp',
  codec: 'amp-message'      // headers.content-type.application
};

// NOTE: create key and cert, see: https://nodejs.org/api/tls.html
if ( options.protocol === 'wss' ) {
	var fs = require('fs');
  options.key = fs.readFileSync(__dirname + '/keys/key.pem'),
  options.cert = fs.readFileSync(__dirname + '/keys/cert.pem'),
  options.ciphers = 'AES256-GCM-SHA384',    // faster, see: https://www.paypal-engineering.com/2014/04/01/outbound-ssl-performance-in-node-js/
  options.rejectUnauthorized = false,
  options.requestCert = true
}

if ( argv.transport ) {
  console.log('use socket transport: ' + argv.transport);
  options.transport = argv.transport
}

var n = 0;
var ops = 10000;
var bytes = 200;   // to fit MTU of 9000.
var prev = 0;
var start = 0;
var fin = false;
var results = [];

var graph = [];
var x = 0;
var persec = 0;

var totalbytes = 0;     // total bytes in all chunks recieved.
var c = 0;              // number of chunks recived.
var byebye = undefined;


var client = nws.connect(options, function(socket) {

socket.on('close', function(chunk) {
	console.log('client socket closed!');
	done();
});


  console.log('connected to pub');
  socket.on('data', function(chunk) {

    if ( fin ) {
      return;
    }

    totalbytes += chunk.length;
    c++;
    //preview('totalbytes: ' + totalbytes + ', chunk', chunk);

    if ( start === 0 ) {
      start = Date.now();
      prev = start;
    }

    if (n++ % ops == 0) {
      var ms = Date.now() - prev;
      var sec = ms / 1000;
      persec = ops / sec | 1;
      results.push(persec);
      process.stdout.write('\r  [' + persec + ' chunks/ps] [' + n + ']');
      prev = Date.now();
    }  

  });
  
  byebye = function() {
    fin = true;
    socket.end();
    socket.destroy();
  };

});



function done(){
  var ms = Date.now() - start;
  var avg = (totalbytes /  bytes) / (ms / 1000);
  byebye();
  console.log(' ');
  console.log(' '); 
  console.log('|--------------------------------------------------------------');
  console.log('| RESULTS ~');
  console.log('|--------------------------------------------------------------');  
  console.log('| total chunks: ' + humanize(c) + ', MB: ' + humanize(totalbytes / 1000) + ', in: ' + humanize(ms / 1000) + ' seconds');
  console.log('|    chunks/ps: ' + humanize(avg));
  console.log('|   throughput: %d MB/s', ((avg * bytes) / 1000 / 1000).toFixed(2)); 
  console.log('|--------------------------------------------------------------');
  console.log(' ');  
  setTimeout(function() {
    process.exit();
   }, 1000);  
}


process.on('SIGINT', done);
//setTimeout(done, ops);
