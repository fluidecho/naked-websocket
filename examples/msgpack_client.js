const nws = require('..');
const msgpack = require('msgpack');    // npm install msgpack

// use same options as: https://nodejs.org/api/net.html
var options = {
  protocol: 'ws',
  hostname: '127.0.0.1',
  port: 8080,
  path: '/foo/bar/?hello=world'
};

var client = nws.connect(options, function(socket) {
  console.log('connected to server!');
  
  if ( socket.body ) {    // if server body was trailing connection header, emit.
    socket.emit('data', socket.body);
  }
   
  var ms = new msgpack.Stream(socket);
  ms.addListener('msg', function(m) {
    console.log('received message: ', m);
  }); 
  
  var payload = {hello: 'from client'};
  var msg = msgpack.pack(payload);
  socket.write(msg);  

});

