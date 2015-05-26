# Naked WebSocket [![Build Status](https://api.travis-ci.org/fluidecho/naked-websocket.png)](https://travis-ci.org/fluidecho/naked-websocket)

Connect peers via WebSocket Protocol with the raw __net__ or __tls__ node.js/io.js sockets.

__Why?__ WebSocket Protocol provides a convenient persistent connection for peers, while the __net__ or __tls__ sockets provide raw communication speed and naked bi-directional messaging.  

_This solution is not for Browser clients, but for common peers using this module._

## Installation

```
npm install naked-websocket
```

## Example

_See examples folder._

#### Server example

```js
var nws = require('naked-websocket');

// use same options as: https://nodejs.org/api/net.html
var options = {
  protocol: 'ws'
};

var server = nws.createServer(options, function(socket) {
  // can examine: socket.headers
  
  console.log('client connected');

  socket.on('data', function(chunk) {
    console.log(chunk.toString());
  });

  socket.write('hello client via net socket');
});

server.listen(8080, function() {
  console.log('server bound');
});

```

#### Client example

```js
var nws = require('naked-websocket');

// use same options as: https://nodejs.org/api/net.html
var options = {
  protocol: 'ws',
  hostname: '127.0.0.1',
  port: 8080
};

var client = nws.connect(options, function(socket) {
  console.log('connected to server!');

  socket.on('data', function(chunk) {
    console.log(chunk.toString());
  });
  
  socket.write('world!');
});

```

### Secure example

_TIP: I've found using HAProxy in front to do SSL/TLS with node.js behind using plain TCP (as above example) shows better performance._ 

#### Server example

```js
var nws = require('naked-websocket');
var fs = require('fs');

// use same options as: https://nodejs.org/api/tls.html, you need to generate own key.pem and cert.pem.
var options = {
  protocol: 'wss',
  slowHandshake: true,    // so can do own auth.
  key: fs.readFileSync(__dirname + '/keys/key.pem'),
  cert: fs.readFileSync(__dirname + '/keys/cert.pem'),
  rejectUnauthorized: false,
  requestCert: true
};

var server = nws.createServer(options, function(socket) {
  // examine: socket.headers.authorization
  if ( !socket.headers.authorization ) {
    socket.goodbye(401);
  } else if ( socket.headers.authorization.password === 'password' ) {
    socket.handshake();
  } else {
    socket.goodbye(401);
  }

  console.log('client connected');
  
  socket.on('data', function(chunk) {
    console.log(chunk.toString());
  });
  
  socket.write('hello client via tls socket');
});

server.listen(8443, function() {
  console.log('server bound');
});

```

#### Client example

```js
var nws = require('naked-websocket');
var fs = require('fs');

// use same options as: https://nodejs.org/api/tls.html, you need to generate key.pem and cert.pem.
var options = {
  protocol: 'wss',
  hostname: '127.0.0.1',
  port: 8443,
  key: fs.readFileSync(__dirname + '/keys/key.pem'),
  cert: fs.readFileSync(__dirname + '/keys/cert.pem'),
  rejectUnauthorized: false,
  requestCert: true,
  auth: 'username:password'
};

var client = nws.connect(options, function(socket) {
  console.log('connected to server!');
  
  socket.on('data', function(chunk) {
    console.log(chunk.toString());
  });
  
  socket.write('world!');
});

```

## Message framing

Naked WebSocket does not frame messages, it leaves this entirely up to each peer. Peers should deploy their own framing technique, could use [WebSocket Protocol Data Framing](http://tools.ietf.org/html/rfc6455#section-5) or something like [AMP](https://github.com/tj/node-amp).

## Options

Can use same as: [https://nodejs.org/api/net.html](https://nodejs.org/api/net.html) (protocol: 'ws') or [https://nodejs.org/api/tls.html](https://nodejs.org/api/tls.html) (protocol: 'wss').

```
     maxbuffer: 4000,          // max header size, 4000 = 4 KB.
       version: '0.0.1',       // must be same on all peers.
      protocol: 'ws',          // 'wss' = secure (TLS), must be same on all peers.
         codec: undefined,     // content-type (mime) eg: 'ldjson' (application/ldjson), 'amp-message' (application/amp-message) [npm install amp-message].
       charset: 'utf8',        // message charset encoding.
 slowHandshake: false,         // true: if you wish to manage own auth at app level.
      timedout: 15000,         // how long to wait for connection.
       noDelay: false          // true = turn nagle batching algorithm off.
```

## License

Choose either: [MIT](http://opensource.org/licenses/MIT) or [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0).

