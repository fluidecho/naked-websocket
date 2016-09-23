# Naked WebSocket

[![build status][travis-image]][travis-url]
[![NPM version][npm-image]][npm-url]
[![node version][node-image]][node-url]

[travis-image]: https://api.travis-ci.org/fluidecho/naked-websocket.png
[travis-url]: https://travis-ci.org/fluidecho/naked-websocket
[npm-image]: https://img.shields.io/npm/v/naked-websocket.svg?style=flat-square
[npm-url]: https://npmjs.org/package/naked-websocket
[node-image]: https://img.shields.io/badge/node.js-%3E=_0.12-blue.svg?style=flat-square
[node-url]: http://nodejs.org/download/

Fastest WebSockets for node to node data exchange.  
  
Connect your back-end node.js applications with WebSockets and exchange data with any format you 
wish, [JSON](https://www.npmjs.com/package/ndjson), [MsgPack](https://www.npmjs.com/package/msgpack), 
none, etc.  
  
__Why not just use socket.io or ws modules?__

You should use socket.io or ws for __Browser__ applications and Naked WebSocket for __back-end__ 
applications. Naked WebSocket is a __much faster__ communication link because it uses the raw _net_ or 
_tls_ sockets, without Browser regard.  
  
Naked WebSocket allows you to use any data framing (message exchange) you wish, for example 
[JSON](https://www.npmjs.com/package/ndjson), [MsgPack](https://www.npmjs.com/package/msgpack), [SMP](https://github.com/smprotocol/smp-node), [AMP](https://github.com/tj/node-amp), none, or any other.  
  
__Why not just use plain old net or tls without WebSockets?__

Because Naked WebSocket gives you a way to connect remote node.js applications via the WebSocket 
Protocol, while still using the _net_ or _tls_ sockets, this is the best of both worlds! You get:  
  
* Firewall friendly access.
* Basic Authentication.
* HTTP Headers.
* Aggree on a message exchange format EG: [JSON](https://www.npmjs.com/package/ndjson), [MsgPack](https://www.npmjs.com/package/msgpack), [SMP](https://github.com/smprotocol/smp-node), [AMP](https://github.com/tj/node-amp), etc.
* Persistent bidirectional remote node communication.
* Full control over the raw _net_ or _tls_ sockets.
  
__...__  
  
_Complies with WebSocket Protocol version 13 as Sub Protocol: 'nws/' + options.version, (you choose own data framing). 
This solution is not for Browser clients, but for common nodes using this module for data exchange 
communication._


## Installation

```
npm install naked-websocket
```

## Example

_See examples folder._

#### Server example

```js
const nws = require('naked-websocket');

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
const nws = require('naked-websocket');

// use same options as: https://nodejs.org/api/net.html
var options = {
  protocol: 'ws',
  hostname: '127.0.0.1',
  port: 8080,
  path: '/foo/bar/?hello=world'
};

var client = nws.connect(options, function(socket) {
  console.log('connected to server!');

  socket.on('data', function(chunk) {
    console.log(chunk.toString());
  });
  
  if ( socket.body ) {    // if server body was trailing connection header, emit.
    socket.emit('data', socket.body);
  }
  
  socket.write('world!');
});

```

### Secure example

#### Server

```js
const nws = require('naked-websocket');
const fs = require('fs');

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

#### Client

```js
const nws = require('naked-websocket');
const fs = require('fs');

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
  
  if ( socket.body ) {    // if server body was trailing connection header, emit.
    socket.emit('data', socket.body);
  }
  
  socket.write('world!');
});

```

## Message framing

Naked WebSocket does not frame messages, it leaves this entirely up to each node. Nodes should deploy their own framing technique, could use [JSON](https://www.npmjs.com/package/ndjson), [MsgPack](https://www.npmjs.com/package/msgpack), [SMP](https://github.com/smprotocol/smp-node), [AMP](https://github.com/tj/node-amp), or your own.

#### Messaging using MsgPack (npm install msgpack) Example

```js
const nws = require('naked-websocket');
const msgpack = require('msgpack');    // npm install msgpack

var server = nws.createServer({protocol: 'ws'}, function(socket) {

  var ms = new msgpack.Stream(socket);
  ms.addListener('msg', function(m) {
    console.log('server received message: ', m);
  });

  var payload = {foo : 'bar', num : 101, 'list-of' : [1, 2, 3], buf: new Buffer('hello')};
  var msg = msgpack.pack(payload);
  socket.write(msg);
  
}).listen(8888);


var options = {
  protocol: 'ws',
  hostname: '127.0.0.1',
  port: 8888
};

var client = nws.connect(options, function(socket) {
  
  if ( socket.body ) {    // if server body was trailing connection header, emit.
    socket.emit('data', socket.body);
  }
   
  var ms = new msgpack.Stream(socket);
  ms.addListener('msg', function(m) {
    console.log('client received message: ', m);
  }); 
  
  var payload = {hello: 'from client'};
  var msg = msgpack.pack(payload);
  socket.write(msg);  
  
});

```

## Options

Can use same as: [https://nodejs.org/api/net.html](https://nodejs.org/api/net.html) (protocol: 'ws') or [https://nodejs.org/api/tls.html](https://nodejs.org/api/tls.html) (protocol: 'wss').

```
     maxbuffer: 4000,          // max header size, 4000 = 4 KB.
       version: '0.0.1',       // must be same on all peers.
      protocol: 'ws',          // 'wss' = secure (TLS), must be same on all peers.
 slowHandshake: false,         // true: if you wish to manage own auth at app level.
      timedout: 15000,         // how long to wait for connection, 15 seconds.
       noDelay: false          // true = turn nagle batching algorithm off.
```
Can set own custom headers.

#### Server example

```
var server = nws.createServer(options, function(socket) {
  
  socket.handshake({headers: {Framing: 'msgpack', 'X-foo': 'bar'}});
  ...
```

#### Client example

```
var options = {
  protocol: 'ws',
  hostname: '127.0.0.1',
  port: 8443,
  headers: {
    Framing: 'msgpack',
    'X-Hello': 'World'
  } 
};

var client = nws.connect(options, function(socket) {
  ...
```

## License

Choose either: [MIT](http://opensource.org/licenses/MIT) or [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0).

