const nws = require('..');
const msgpack = require('msgpack');		// npm install msgpack

// use same options as: https://nodejs.org/api/net.html
var options = {
  protocol: 'ws'
};

var server = nws.createServer(options, function(socket) {

  console.log('client connected');

  var ms = new msgpack.Stream(socket);
  ms.addListener('msg', function(m) {
    console.log('received message: ', m);
  });

  var payload = {foo : 'bar', num : 101, 'list-of' : [1, 2, 3], buf: new Buffer('hello')};
  var msg = msgpack.pack(payload);
	socket.write(msg);
	
});

server.listen(8080, function() {
  console.log('server bound');
});

