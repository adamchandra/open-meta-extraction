#!/bin/bash

SCRIPT=$(readlink -f "$0")
BIN=$(dirname "$SCRIPT")
. $BIN/paths.sh

$BIN/docker-down.sh
# echo "docker volume prune"
# docker volume prune --force

$BIN/build-images.sh
$BIN/docker-up.sh
