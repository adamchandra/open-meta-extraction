#!/bin/bash

SCRIPT=$(readlink -f "$0")
BIN=$(dirname "$SCRIPT")
. $BIN/paths.sh

echo 'initializing volumes'

docker volume create rest-portal-logs
