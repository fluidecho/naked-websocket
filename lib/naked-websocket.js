"use strict";
//
// naked-websocket
//
// Version: 0.0.2
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


// options, set through app.
var Options = {
  maxbuffer: 4000,        // max header size, 4000 = 4 KB.
  version: '0.0.2',       // must be same on all peers.
  protocol: 'ws',         // 'wss' = secure (TLS), must be same on all peers.
  codec: undefined,       // content-type (mime) eg: 'json' (application/ldjson), 'amp-message' (application/amp-message) [npm install amp-message].
  charset: 'utf8',        // message charset encoding.
  slowHandshake: false,   // true: if you wish to manage own auth at app level.
  timedout: 15000         // how long to wait for connection.
};


// private:
var LF = 10;    // line feed is 10 decimal value in ascii eg: \n = 10.
var CR = 13;    // carage return is 13 decimal value in ascii eg: \r = 13.



function createServer(options, fn) {
  
  for ( var o in Options ) if ( !options[o] ) options[o] = Options[o];
  
  preview('createServer, options', options);
  
  var self = this;
  self.options = options;
  
  var ss = undefined;   // socket service, net (tcp) or tls.
  if ( self.options.protocol === 'wss' ) {
    ss = require('tls');    // WebSocket through TLS (SSL)
  } else {  
    ss = require('net');    // WebSocket through TCP
  }
  
  self.server = ss.createServer(options, function(socket) {
    
    preview('client connected');
    
    socket.on('error', function(err) {
      preview('error, code: ' + err.code, err.message);
      self.server.emit('error', err);
    });
    
    if ( options.noDelay ) {
      socket.setNoDelay(true);   // turn nagle batching algorithm off.
    }
    
    socket.handshake = function(){
      if ( !socket.writable ) return;
      preview('handshake');
      socket.handshaked = true;
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' + 
        'Upgrade: websocket\r\n' + 
        'Connection: Upgrade\r\n' + 
        'Sec-WebSocket-Version: nws-'+self.options.version+'\r\n' + 
        'Sec-WebSocket-Protocol: nws\r\n' + 
        'Content-Type: application/'+self.options.codec+'; charset='+self.options.charset+'\r\n' +
        '\r\n');
      return;
    };
      
    socket.goodbye = function(code, message){
      if ( !socket.writable ) return;
      preview('goodbye');
      if ( !code ) code = 403;
      socket.end(
        'HTTP/1.1 ' + code + '\r\n' + 
        'Connection: closed\r\n' + 
        'Content-Type: application/json; charset=utf-8\r\n' + 
        '\r\n' +
        JSON.stringify({"status": message}) + '\r\n');
      return;
    };
    
    //socket.setEncoding('utf8');   // DONT USE, will convert buffer to string.
    
    var connected = false;
    var buffer = new Buffer(0);   // concat until header completed.
    socket.on('data', function(chunk) {
      if ( !connected ) {
        serverParser(self, buffer, chunk, socket, function(s) {
          connected = true;
          if ( s != false ) {
            return fn(s);   // return parsed socket back to app.
          }
        });
      }
    });

  });

  return self.server;   // return the server object.

}



function connect(options, fn) {
  
  for ( var o in Options ) if ( !options[o] ) options[o] = Options[o];
  
  preview('connect, options', options);
  
  var self = this;
  self.options = options;
  
  // Client, as EventEmitter.
  var Client = function() {
    EventEmitter.call(this);
  };  
  util.inherits(Client, events.EventEmitter);   
  var client = new Client(); 

  var timedOut = setTimeout(function() { 
    preview('connection timedout!');
    var err = new Error("connection timedout")
    client.emit('error', err);
    self.socket.destroy();
    return;
  }, self.options.timedout);

  var ss = undefined;   // socket service, net (tcp) or tls.
  if ( self.options.protocol === 'wss' ) {
    ss = require('tls');    // WebSocket through TLS (SSL)
  } else {  
    ss = require('net');    // WebSocket through TCP
  }
  
  self.socket = ss.connect({port: options.port, host: options.hostname}, options, function() {
    
    preview('client connected to server, send websoket upgrade request');

    var auth = '';
    if ( options.auth != undefined ) {
      auth = 'Authorization: Basic ' + new Buffer(options.auth).toString('base64') + '\r\n';
    }

    var apikey =  crypto.randomBytes(Math.ceil(32 * 3 / 4))
      .toString('base64')     // buffer to base64.
      .slice(0, 32)           // trim length.
      .replace(/\+/g, '0')    // make url friendly.
      .replace(/\//g, '0');   // make url friendly.
    
    self.socket.write('GET ' + options.path + ' HTTP/1.1' + '\r\n' +
      'Host: localhost' + '\r\n' +
      'Upgrade: websocket' + '\r\n' +
      'Connection: Upgrade' + '\r\n' +
      'Sec-WebSocket-Version: nws-'+self.options.version+ '\r\n' +
      'Sec-WebSocket-Protocol: nws' + '\r\n' +
      'Apikey: ' + apikey + '\r\n' +
      'Content-Type: application/'+self.options.codec+'; charset='+self.options.charset+'\r\n' +
      auth +
      '\r\n');

  });
  
  //self.socket.setEncoding('utf8');    // DONT USE, will convert buffer to string.

  if ( options.noDelay ) {
    self.socket.setNoDelay(true);   // turn nagle batching algorithm off.
  }

  self.socket.on('error', function(err) {
    preview('connect', 'self.socket, error', err);
    client.emit('error', err);
  });
  
  self.socket.on('close', function() {
    preview('connect', 'self.socket, close');
    client.emit('close', true);
  }); 

  // HTTP Parser.
  var connected = false;
  var buffer = new Buffer(0);   // concat until header completed.
  self.socket.on('data', function(chunk) {
    if ( !connected ) {
      clientParser(self, buffer, chunk, self.socket, function(s) {
        connected = true;
        clearTimeout(timedOut);   // okay.      
        if ( s != false ) {
          return fn(s);   // return parsed socket back to app.
        }
      });
    }
  });

  return client;    // return the server object.

}



function serverParser(self, buffer, chunk, socket, _fn) {
  
  preview('server, parser, chunk', chunk.toString());
  
  // validate request headers.
  var HEADS = {
    'method' : 'GET',
    'upgrade' : 'websocket',
    'connection' : 'upgrade',
    'sec-websocket-version' : 'nws-'+self.options.version,
    'sec-websocket-protocol' : 'nws'
  };

  buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length);    // on chunk concate buffer. 

  if ( buffer.length > self.options.maxbuffer ) {
    socket.goodbye(403, 'Invalid Request');
    return _fn(false);   
  }

  var timedOut = setTimeout(function() { 
    preview('connection timedout!');
    socket.goodbye(408, 'Request Timeout');
    return _fn(false);    
  }, self.options.timedout);


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
        
        var rawHeaders = headersString.split('\r\n');
        //preview('rawHeaders', rawHeaders);
        
        var line0 = rawHeaders[0].split(' ');
        if ( HEADS.method === line0[0] ) {
          HEADS.method = true;
          headers.method = line0[0];
        }
        headers.url = url.parse(line0[1]);
        headers.url.protocol = self.options.protocol;
      
        // loop through raw header folloing line 0:
        var h = 1;
        for (h = 1; h < rawHeaders.length; h++) {
          var headerRow = rawHeaders[h].split(': ');
          //preview('headerRow', headerRow);
          
          if ( headerRow[0].toLowerCase() === 'content-type' ) {
            headers['content-type'] = {raw:headerRow[1]};
            var ct = headerRow[1].split(' ');
            headers['content-type'].application = ct[0].substring(ct[0].indexOf('/') + 1, ct[0].length - 1);
            headers['content-type'].charset = ct[1].substring(ct[1].indexOf('charset=') + 8);
          }
          
          // authorization: set options.slowHandshake = true to manage own auth.
          if ( headerRow[0].toLowerCase() === 'authorization' ) {     
            var token = headerRow[1].split(/\s+/).pop()||'',          // auth token
            plain = new Buffer(token, 'base64').toString(),           // convert from base64
            parts = plain.split(/:/);                                 // split on colon
            headers.authorization = { scheme: 'basic', username: parts[0], password: parts[1] };  
          }
          
          if ( headerRow[0].toLowerCase() === 'apikey' ) {
            headers.apikey = headerRow[1].toString('ascii');
          }         
          
          if ( HEADS[headerRow[0].toLowerCase()] != undefined ) {
            if ( HEADS[headerRow[0].toLowerCase()] === headerRow[1].toLowerCase() ) {
              headers[headerRow[0].toLowerCase()] = headerRow[1];
              HEADS[headerRow[0].toLowerCase()] = true;   // so can validate request.
            }
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

      if ( !self.options.slowHandshake ) {
        socket.handshake(socket);
      }

      return _fn(socket);
          
    }

  }
  
}



function clientParser(self, buffer, chunk, socket, _fn) {
  
  preview('client, parser, chunk', chunk.toString());

  // validate request headers.
  var HEADS = {
    'upgrade' : 'websocket',
    'connection' : 'upgrade',
    'sec-websocket-version' : 'nws-'+self.options.version,
    'sec-websocket-protocol' : 'nws'
  };  

  buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length);    // on chunk concate buffer. 

  if ( buffer.length > self.options.maxbuffer ) {
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
      
        var rawHeaders = headersString.split('\r\n');
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
          
          if ( headerRow[0].toLowerCase() === 'content-type' ) {
            headers['content-type'] = {raw:headerRow[1]};
            var ct = headerRow[1].split(' ');
            headers['content-type'].application = ct[0].substring(ct[0].indexOf('/') + 1, ct[0].length - 1);
            headers['content-type'].charset = ct[1].substring(ct[1].indexOf('charset=') + 8);
          }
          
          if ( HEADS[headerRow[0].toLowerCase()] != undefined ) {
            if ( HEADS[headerRow[0].toLowerCase()] === headerRow[1].toLowerCase() ) {
              headers[headerRow[0].toLowerCase()] = headerRow[1];
              HEADS[headerRow[0].toLowerCase()] = true;   // so can validate request.
            }
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

