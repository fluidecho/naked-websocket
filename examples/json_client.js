const nws = require('..');
const ndjson = require('ndjson');    // npm install ndjson

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

  socket.pipe(ndjson.parse()).on('data', function(obj) {
    // obj is a javascript object 
    console.log('received obj', obj);
  });

  var serialize = ndjson.serialize()
  serialize.on('data', function(line) {
    // line is a line of stringified JSON with a newline delimiter at the end 
    console.log('ndjson: ', line);
    socket.write(new Buffer(line)); 
  });
  serialize.write({"from": "client"});
  serialize.end();

});
    
