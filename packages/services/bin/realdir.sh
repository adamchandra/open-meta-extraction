#!/bin/sh

root=$(dirname "$1")/..
jq .responseUrl "$root/metadata.json"
