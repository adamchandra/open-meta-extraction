#!/bin/bash

SCRIPT=`basename $0`

showhelp() {
    echo "Usage: $SCRIPT -d ./path/to/shared/dir "
    exit 2
}

# default arg vals
sharepath=

while getopts "d:h" name; do
    case $name in
        d)    sharepath=$OPTARG;;
        h)    showhelp $0;;
        [?])  showhelp $0;;
    esac
done

if [ ! -d "$sharepath" ]; then
    echo "Path $sharepath does not exist, exiting"
    showhelp
    ## ...
fi

IMAGE=adamchandra/service-portal
APP_SHARE_MOUNT=/usr/src/app/app-share.d

echo docker run --name=$IMAGE -d -v $sharepath:$APP_SHARE_MOUNT $IMAGE

