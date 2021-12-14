#!/bin/bash

SCRIPT=$(readlink -f "$0")
BIN=$(dirname "$SCRIPT")
. "$BIN/paths.sh"

# for imaged in $IMAGES/*
imageDirs=("$IMAGES/service-portal")


for imaged in "${imageDirs[@]}";
do
    base=$(basename $imaged)
    tag="adamchandra/$base"
    dockerfile="$imaged/Dockerfile"

    echo "docker build -t $tag -f $dockerfile ."
    docker builder build \
           -t $tag -f $dockerfile \
           --build-arg USER_ID=$(id -u ${USER}) \
           --build-arg GROUP_ID=$(id -g ${USER}) \
           .
done
