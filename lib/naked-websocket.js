"use strict";
//
// naked-websocket
//
// Version: 0.0.5
// Author: Mark W. B. Ashcroft (mark [at] fluidecho [dot] com)
// License: MIT or Apache 2.0.
//
// Copyright (c) 2015 Mark W. B. Ashcroft.
// Copyright (c) 2015 FluidEcho.
//


var preview       = require('preview')('naked-websocket');
var util          = require('util');
var url           = require('url');
var querystring   = require('querystring');
var crypto        = require('crypto');
var events        = require('events');
var EventEmitter  = events.EventEmitter;


// public:
exports.createServer    = createServer;
exports.connect         = connect;


// options, set through app (also: 'headers' and 'path' (connect)):
var Options = {
  maxbuffer: 4000,        // max header size, 4000 = 4 KB.
  version: '0.0.1',       // must be same on all peers.
  protocol: 'ws',         // 'wss' = secure (TLS), must be same on all peers.
  slowHandshake: false,   // true: if you wish to manage own auth at app level.
  timedout: 15000         // how long to wait for connection, 15 seconds.
};


// private:
var LF = 10;              // line feed is 10 decimal value in ascii eg: \n = 10.
var CR = 13;              // carage return is 13 decimal value in ascii eg: \r = 13.
var CRLF = '\r\n';



function createServer(options, fn) {

  for ( var o in Options ) if ( !options[o] ) options[o] = Options[o];

  preview('createServer, options', options);

  var self = this;

  var transport = undefined;   // socket transport, net (tcp) or tls.
  if ( options.protocol === 'wss' ) {
    transport = require('tls');    // WebSocket through TLS (SSL)
  } else {  
    transport = require('net');    // WebSocket through TCP
  }

  var Server = transport.createServer(options, function(socket) {

    preview('client connected');

    socket.on('error', function(err) {
      preview('error, code: ' + err.code, err.message);
      Server.emit('error', err);
    });

    if ( options.noDelay ) {
      socket.setNoDelay(true);   // turn nagle batching algorithm off.
    }
    
    socket.handshaked = false;

    socket.handshake = function(opts){
      if ( !socket.writable || socket.handshaked ) return;
      preview('handshake, opts', opts);
      var headers = '';
      if ( opts != undefined ) {
        if ( opts.headers != undefined ) {
          for ( var h in opts.headers ) {
            headers += h + ': ' + opts.headers[h] + CRLF;
          }
        }
      }
      preview('headers', headers);   
      socket.handshaked = true;
      socket.write(
        'HTTP/1.1 101 Switching Protocols' + CRLF +
        'Upgrade: websocket' + CRLF +
        'Connection: Upgrade' + CRLF +
        'Sec-WebSocket-Accept: ' + crypto.randomBytes(Math.ceil(28 * 3 / 4)).toString('base64').replace(/\//g, '0') + CRLF +    // return random.
        'Sec-WebSocket-Version: nws-' + options.version + CRLF +
        'Sec-WebSocket-Protocol: nws' + CRLF +
        headers +
        CRLF, 'ascii');
      return;
    };

    socket.goodbye = function(code, message){
      if ( !socket.writable ) return;
      preview('goodbye');
      if ( !code ) code = 403;
      socket.end(
        'HTTP/1.1 ' + code + CRLF + 
        'Connection: closed' + CRLF +
        'Content-Type: application/json; charset=utf-8' + CRLF +
        CRLF +
        JSON.stringify({"status": message}) + CRLF +
        CRLF, 'ascii');
      return;
    };

    socket.connected = false;
    var buffer = new Buffer(0);   // concat until header completed.
    socket.on('data', function(chunk) {
      //preview('socket.on, data, chunk', chunk.toString());
      if ( !socket.connected ) {
        serverParser(options, buffer, chunk, socket, function(s) {
          socket.connected = true;
          if ( s != false ) {
            return fn(s);   // return parsed socket back to app.
          }
        });
      }
    });

  });

  return Server;   // return the server object.

}



function connect(options, fn) {

  for ( var o in Options ) if ( !options[o] ) options[o] = Options[o];

  preview('connect, options', options);

  var self = this;

  var headers = '';
  if ( options.headers != undefined ) {
    for ( var h in options.headers ) {
      headers += h + ': ' + options.headers[h] + CRLF;
    }
  }

  if ( options.path === undefined || options.path === '' ) {
    options.path = '/';
  }

  // client, as EventEmitter.
  var Client = function() {
    EventEmitter.call(this);
  };  
  util.inherits(Client, events.EventEmitter);   
  var client = new Client(); 

  var timedOut = setTimeout(function() { 
    preview('connection timedout!');
    var err = new Error("connection timedout")
    client.emit('error', err);
    Socket.destroy();
    return;
  }, options.timedout);

  var transport = undefined;   // socket transport, net (tcp) or tls.
  if ( options.protocol === 'wss' ) {
    transport = require('tls');    // WebSocket through TLS (SSL)
  } else {  
    transport = require('net');    // WebSocket through TCP
  }

  var Socket = transport.connect({port: options.port, host: options.hostname}, options, function() {

    preview('client connected to server, send websoket upgrade request');

    var auth = '';
    if ( options.auth != undefined ) {
      auth = 'Authorization: Basic ' + new Buffer(options.auth).toString('base64') + CRLF;
    }

    Socket.write('GET ' + options.path + ' HTTP/1.1' + CRLF +
      'Host: localhost' + CRLF +
      'Upgrade: websocket' + CRLF +
      'Connection: Upgrade' + CRLF +
      'Sec-WebSocket-Key: ' + crypto.randomBytes(Math.ceil(24 * 3 / 4)).toString('base64').replace(/\//g, '0') + CRLF +
      'Sec-WebSocket-Version: nws-' + options.version + CRLF +
      'Sec-WebSocket-Protocol: nws' + CRLF +
      auth +
      headers +
      CRLF, 'ascii');

  });
  
  if ( options.noDelay ) {
    Socket.setNoDelay(true);   // turn nagle batching algorithm off.
  }

  Socket.on('connect', function() {
    client.emit('connect', true);
  });

  Socket.on('error', function(err) {
    preview('connect', 'socket, error', err);
    client.emit('error', err);
  });
  
  Socket.on('close', function() {
    preview('connect', 'socket, close');
    client.emit('close', true);
  });

  // HTTP Parser.
  Socket.connected = false;
  var buffer = new Buffer(0);   // concat until header completed.
  Socket.on('data', function(chunk) {
    if ( !Socket.connected ) {
      clientParser(options, buffer, chunk, Socket, function(s) {
        Socket.connected = true;
        clearTimeout(timedOut);   // okay.      
        if ( s != false ) {
          return fn(s);   // return parsed socket back to app.
        }
      });
    }
  });

  return client;    // return the server object.

}



function serverParser(options, buffer, chunk, socket, _fn) {
  
  preview('server, parser, chunk', chunk.toString());
  
  // validate request headers.
  var HEADS = {
    'method' : 'GET',
    'upgrade' : 'websocket',
    'connection' : 'upgrade',
    'sec-websocket-version' : 'nws-'+options.version,
    'sec-websocket-protocol' : 'nws'
  };

  buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length);    // on chunk concate buffer. 

  if ( buffer.length > options.maxbuffer ) {
    socket.goodbye(403, 'Invalid Request');
    return _fn(false);   
  }

  var timedOut = setTimeout(function() { 
    preview('connection timedout!');
    socket.goodbye(408, 'Request Timeout');
    return _fn(false);    
  }, options.timedout);


  var bufferLoop = new Buffer(buffer.length);
  bufferLoop = buffer;

  // examine chunk for header.
  var i = 0;
  for (i = 0; i < bufferLoop.length; i++) {

    if ( bufferLoop[i] === CR && bufferLoop[i + 1] == LF && bufferLoop[i + 2] == CR && bufferLoop[i + 3] == LF  ) {
      //preview('header here, at: ' + i);
      
      var headers = {};
      var headersString = bufferLoop.slice(0, i + 4).toString('ascii');
      
      preview('headersString: ' + headersString);
      
      try {
        
        var rawHeaders = headersString.split(CRLF);
        //preview('rawHeaders', rawHeaders);
        
        var line0 = rawHeaders[0].split(' ');
        if ( HEADS.method === line0[0] ) {
          HEADS.method = true;
          headers.method = line0[0];
        }
        headers.url = url.parse(line0[1]);
        headers.url.protocol = options.protocol;
      
        // loop through raw header folloing line 0:
        var h = 1;
        for (h = 1; h < rawHeaders.length; h++) {
          var headerRow = rawHeaders[h].split(': ');
          //preview('headerRow', headerRow);
          
          if ( headerRow[0] === '' || headerRow[0] === undefined || headerRow[1] === '' || headerRow[1] === undefined ) {
            continue;
          }
      
          // authorization: set options.slowHandshake = true to manage own auth.
          if ( headerRow[0].toLowerCase() === 'authorization' ) {     
            var token = headerRow[1].split(/\s+/).pop()||'',          // auth token
            plain = new Buffer(token, 'base64').toString(),           // convert from base64
            parts = plain.split(/:/);                                 // split on colon
            headers.authorization = { scheme: 'basic', username: parts[0], password: parts[1] };  
          }       
          
          if ( HEADS[headerRow[0].toLowerCase()] != undefined ) {
            if ( HEADS[headerRow[0].toLowerCase()] === headerRow[1].toLowerCase() ) {
              headers[headerRow[0]] = headerRow[1];
              HEADS[headerRow[0].toLowerCase()] = true;   // so can validate request.
            }
          } else {
            headers[headerRow[0]] = headerRow[1];
          }
          
        }
      
      } catch(e) {
      
        // err, invaid header format, close socket!
        preview('caught error in request, e', e);
        socket.goodbye(403, 'Invalid Request');
        return _fn(false);
            
      }
      
      // make sure is valid request.
      for ( var head in HEADS ) {
        if ( HEADS[head] != true ) {
          socket.goodbye(403, 'Invalid Request');
          return _fn(false);
        }
      }

      clearTimeout(timedOut);   // okay.

      //preview('headers', headers);
      socket.headers = headers;
      socket.rawHeaders = rawHeaders;
      socket.client = { hostname: socket.remoteAddress, port: socket.remotePort };
      //preview('client', socket.client);   

      preview('serverParser', 'options', options);

      if ( !options.slowHandshake ) {
        socket.handshake();
      }

      return _fn(socket);
 
    }

  }

}



function clientParser(options, buffer, chunk, socket, _fn) {

  preview('client, parser, chunk', chunk.toString());

  // validate request headers.
  var HEADS = {
    'upgrade' : 'websocket',
    'connection' : 'upgrade',
    'sec-websocket-version' : 'nws-'+options.version,
    'sec-websocket-protocol' : 'nws'
  };  

  buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length);    // on chunk concate buffer. 

  if ( buffer.length > options.maxbuffer ) {
    preview('maxbuffer exceeded!');
    socket.end();
    return _fn(false); 
  }

  var bufferLoop = new Buffer(buffer.length);
  bufferLoop = buffer;

  // examine chunk for header.
  var i = 0;
  for (i = 0; i < bufferLoop.length; i++) {

    if ( bufferLoop[i] === CR && bufferLoop[i + 1] == LF && bufferLoop[i + 2] == CR && bufferLoop[i + 3] == LF  ) {
      //console.log('header here, at: ' + i);

      var headers = {};
      var headersString = bufferLoop.slice(0, i).toString('ascii');
      //preview('headersString: ' + headersString);

      try {

        var rawHeaders = headersString.split(CRLF);
        //preview('rawHeaders', rawHeaders);
        
        var status_code = rawHeaders[0].replace(/^\s+|\s+$/g,'').substring(9, 12);    // "HTTP/1.1 "<STATUS_CODE>
        //preview('status_code', status_code);
            
        if ( status_code != 101 ) {     // 101: switching protocol.
          preview('not valid response code: ' + status_code);
          return _fn(false);
        } 
      
        // loop through raw header folloing line 0:
        var h = 1;
        for (h = 1; h < rawHeaders.length; h++) {
          var headerRow = rawHeaders[h].split(': ');
          //preview('headerRow', headerRow);

          if ( headerRow[0] === '' || headerRow[0] === undefined || headerRow[1] === '' || headerRow[1] === undefined ) {
            continue;
          }
   
          if ( HEADS[headerRow[0].toLowerCase()] != undefined ) {
            if ( HEADS[headerRow[0].toLowerCase()] === headerRow[1].toLowerCase() ) {
              headers[headerRow[0]] = headerRow[1];
              HEADS[headerRow[0].toLowerCase()] = true;   // so can validate request.
            }
          } else {
            headers[headerRow[0]] = headerRow[1];
          }
          
        }

      } catch(e) {

        preview('invalid header, end');
        socket.end();
        return _fn(false);
      
      }

      // make sure is valid request.
      for ( var head in HEADS ) {
        if ( HEADS[head] != true ) {
          preview('invalid head.header, end');
          socket.end();
          return _fn(false);
        }
      }

      preview('headers', headers);
      socket.headers = headers;
      socket.rawHeaders = rawHeaders;

      return _fn(socket);
          
    }

  }
  
}

