var nws = require('./');
var assert = require('assert');

var closed;

nws.createServer({protocol: 'ws', noDelay: true}, function(sser) {
  sser.on('data', function(chunk) {
    chunk = chunk.toString();
    console.log(chunk);
    assert.equal(chunk, 'k');
    closed = true;
    sser.end();
  });
  setTimeout(function(){
    sser.write('o');
  }, 50);   
}).listen(8585, function() { 
  nws.connect({protocol: 'ws', hostname: '127.0.0.1', port: 8585, noDelay: true}, function(sclt) {
    sclt.on('data', function(chunk) {
        chunk = chunk.toString();
        console.log(chunk);
        assert.equal(chunk, 'o');
        sclt.write('k');
    });
    sclt.on('close', function() {
      assert(closed);
      process.exit(0);
    });
  });
});

