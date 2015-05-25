# Naked WebSocket [![Build Status](https://api.travis-ci.org/fluidecho/naked-websocket.png)](https://travis-ci.org/fluidecho/naked-websocket)

Connect peers via WebSocket Protocol with the raw __net__ or __tls__ node.js/io.js sockets.

__Why?__ WebSocket Protocol provides a convenient persistent connection for peers, while the __net__ or __tls__ sockets provide raw communication speed and naked bi-directional messaging.  

_This solution is not for Browser clients, but for common peers using this module._

## Installation

```
npm install naked-websocket
```

## Example

Server example

```js
var nws = require('naked-websocket');

// use same options as: https://nodejs.org/api/tcp.html
var options = {
  protocol: 'ws'    // or 'wss' for secure.
};

var server = nws.createServer(options, function(socket) {
  console.log('client connected');
  socket.write('hello client via net socket');
  socket.on('data', function(chunk) {
    console.log(chunk.toString());
  });
});

server.listen(8000, function() {
  console.log('server bound');
});

```

Client example

```js
var nws = require('naked-websocket');

// use same options as: https://nodejs.org/api/tcp.html
var options = {
  protocol: 'ws'    // or 'wss' for secure.
  port: 8000
};

var client = nws.connect(options, function() {
  console.log('connected to server!');
  client.write('world!');
});

client.on('data', function(chunk) {
  console.log(chunk.toString());
});

```

## Notes

Naked WebSocket does not frame messages, it leaves this entirely up to each peer. Peers should deploy their own framing technique, could use [WebSocket Protocol Data Framing](http://tools.ietf.org/html/rfc6455#section-5) or something like [AMP](https://github.com/tj/node-amp).

## License

Choose either: [MIT](http://opensource.org/licenses/MIT) or [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0).

