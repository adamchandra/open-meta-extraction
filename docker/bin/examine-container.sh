#!/bin/bash

docker run --rm -it -v /var/run/docker.sock:/var/run/docker.sock wagoodman/dive:latest $


#!/bin/bash

# ## http://stackoverflow.com/questions/59895/getting-the-source-directory-of-a-bash-script-from-within
# SOURCE="BASH_SOURCE[0]"
# while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
#     DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
#     SOURCE="$(readlink "$SOURCE")"
#     [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
# done
# SCRIPTDIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
SCRIPT=`basename $0`

showhelp() {
    echo "Usage: $SCRIPT: "
    echo "  todo  "
    exit 2
}

# default arg vals
hosts=

while getopts "m:h" name; do
    case $name in
        m)    hosts=$OPTARG;;
        h)    showhelp $0;;
        [?])  showhelp $0;;
    esac
done

if [ -z "$hosts" ]; then
    ## ...
fi

