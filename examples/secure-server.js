const nws = require('..');
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
  console.log('socket.headers', socket.headers);    // examine: socket.headers.authorization

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
