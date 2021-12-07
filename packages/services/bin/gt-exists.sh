#!/bin/sh


root=$(dirname "$1")
# echo "checking $root/*.gt"
# ls "$root"/*.gt

if ls "$root"/*.gt 1> /dev/null 2>&1; then
    echo "ground-truth files exist"
    exit 1
else
    echo "ground-truth files do not exist"
    exit 0
fi
