var nws = require('..');

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
  
  if ( socket.body ) {    // if server body was trailing connection header, emit.
    socket.emit('data', socket.body);
  }
  
  socket.write('world!');
});
