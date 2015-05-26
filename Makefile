CFLAGS=-g
export CFLAGS

bench:
	node ./benchmark/pub.js &
	sleep 5
	node ./benchmark/sub.js

