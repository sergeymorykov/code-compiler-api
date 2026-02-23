#!/bin/sh
# Not used when we exec from API; kept for manual/testing.
# API uses: exec sh -c "g++ -o /workspace/a.out /workspace/main.cpp ..." then "timeout 5 /workspace/a.out"
set -e
: "${RUN_TIMEOUT:=5}"
g++ -o /workspace/a.out /workspace/main.cpp "$@"
exec timeout "$RUN_TIMEOUT" /workspace/a.out
