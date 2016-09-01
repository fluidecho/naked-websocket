const nws = require('..');
const ndjson = require('ndjson');        // npm install ndjson

// use same options as: https://nodejs.org/api/net.html
var options = {
  protocol: 'ws'
};

var server = nws.createServer(options, function(socket) {

  console.log('client connected');

  socket.pipe(ndjson.parse()).on('data', function(obj) {
    // obj is a javascript object 
    console.log('received obj', obj);
  });
  
  var serialize = ndjson.serialize()
  serialize.on('data', function(line) {
    // line is a line of stringified JSON with a newline delimiter at the end 
    console.log('djson: ', line);
    socket.write(new Buffer(line)); 
  });
  serialize.write({"from": "server"});
  serialize.end();  
    
});

server.listen(8080, function() {
  console.log('server bound');
});

