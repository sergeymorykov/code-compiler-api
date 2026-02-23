#!/bin/sh
# Not used when we exec from API; kept for manual/testing.
set -e
: "${RUN_TIMEOUT:=5}"
clang++ -o /workspace/a.out /workspace/main.cpp "$@"
exec timeout "$RUN_TIMEOUT" /workspace/a.out
