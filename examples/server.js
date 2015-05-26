var nws = require('..');
var preview = require('preview')('nws-example-server');    // node server.js --preview

// use same options as: https://nodejs.org/api/net.html
var options = {
  protocol: 'ws'
};

var server = nws.createServer(options, function(socket) {
  console.log('client connected');

  preview('socket.headers', socket.headers);

  socket.on('data', function(chunk) {
    console.log(chunk.toString());
  });

  socket.write('hello client via net socket');
});

server.listen(8080, function() {
  console.log('server bound');
});
