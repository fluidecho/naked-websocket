const nws = require('..');
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
