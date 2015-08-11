"use strict";
//
// naked-websocket: benchmark pub
//
// Version: 0.0.1
// Author: Mark W. B. Ashcroft (mark [at] fluidecho [dot] com)
// License: MIT or Apache 2.0.
//
// Copyright (c) 2015 Mark W. B. Ashcroft.
// Copyright (c) 2015 FluidEcho.
//


var preview = require('preview')('nws_pub');
var argv = require('minimist')(process.argv.slice(2));
var humanize = require('humanize-number');
var nws = require('..');


// use same options as: https://nodejs.org/api/tcp.html
var options = {
  protocol: 'ws',           // or 'wss' for secure.
  slowHandshake: false,       // true: can do your own authorization and handshake or close socket.
  noDelay: true               // true: turn Nagle tcp batching off.
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


var ops = 10000;
var msgsize = 200;   // to fit MTU of 9000.
var buf = new Buffer(Array(msgsize).join('a'));
var x = 0;
console.log('sending %d byte messages', buf.length);

process.stdin.resume();		//so the program will not close instantly

function exitHandler(options, err) {
  if (options.cleanup) console.log('sub closed, exit, x: ' + x);
  if (err) console.log(err.stack);
  if (options.exit) process.exit();
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));





var server = nws.createServer(options, function(socket) {

  console.log('sub client connected');
  
  preview('socket', socket);

  socket.on('close', function() {
    preview('sub closed, exit');
    process.exit();
  });

  setTimeout(function() {
    console.log('timedout, exit. bytes sent: ' + humanize(x / 1000) + ' MBs');
    socket.end();
    socket.destroy();
    process.exit();
   }, ops);   

  function more() {
    if ( !argv.slow ) {
      if ( socket.writable && socket.handshaked ) {
		    socket.write( buf );
		    x += buf.length;
		    setImmediate(more);
      }
    } else {
      setInterval(function(){
        if ( socket.writable && socket.handshaked ) {
          socket.write( buf );
        }
      }, 1000);
    }
  }

  more();
  
});

server.listen(8080, function() { //'listening' listener
  console.log('server bound');
});

server.on('error', function(err) {
  preview('server.on.error', err);
  process.exit();
}); 


