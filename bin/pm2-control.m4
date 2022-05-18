#!/bin/bash
#############################
# shellcheck disable=2154
#
# ARGBASH_SET_INDENT([  ])
# DEFINE_SCRIPT_DIR([_script_dir])
#
# ARG_OPTIONAL_BOOLEAN([verbose])
# ARG_OPTIONAL_BOOLEAN([dry-run], [])
# ARG_OPTIONAL_SINGLE([env], [], [Env Mode], [unspecified])
# ARG_TYPE_GROUP_SET([envmode], [ENVMODE], [env], [dev,test,prod], [])
# ARG_HELP([PM2 Control], [Wrapper around PM2 start/stop/etc.])
#
# ARG_OPTIONAL_ACTION([rebuild-script],[],[Rebuild this script (requires argbash installed)],[do_rebuild_script])
# ARG_OPTIONAL_ACTION([start],[],[Start pm2 with *-ecosystem.config],[pm2_start])
# ARG_OPTIONAL_ACTION([reset],[],[stop/flush logs/del all],[pm2_reset])
# ARG_OPTIONAL_ACTION([restart],[],[reset + start],[pm2_restart])
#
# ARGBASH_PREPARE()
#
# [ <-- needed because of Argbash


# shopt -s extglob
# set -euo pipefail

readonly script_dir=$_script_dir


arg() {
    local argname="${1:-unspecified}"
    test "$argname" == "unspecified" && die "Error: no argument name passed to arg()"

    local argloc="_arg_$argname"
    test -z ${!argloc+x} && die "Error: arg $argname (expected in \$$argloc) is unset"

    local argval=${!argloc}

    # echo "arg $argname (expected in \$$argloc) = $argval"

    ## 'return' the value of the parsed argument in the passed in string
    eval "$argname"="$argval"
}

####
## Run the given command, allowing for --dry-run option to just print the command
doit() {
    arg dry_run
    arg env
    test "$env" == "unspecified" && _PRINT_HELP=yes die "Error: must specify --env=..."
    export NODE_ENV="$env"

    local cmds=("$@")
    if [ "$dry_run" = on ]; then
        echo "dry> ${cmds[*]}"
    else
        echo "run> ${cmds[*]}"
        "${cmds[@]}"
    fi

    echo ""
}

####
## CD into dirs, verbosely failing on first non-existent dir
with_dirs() {
    local dirnames=("$@")
    for d in "${dirnames[@]}"; do
        if [ ! -d "$d" ]; then
            #   test -f "$_arg_infile" || _PRINT_HELP=yes die "Can't continue, have to supply file as an argument, got '$_arg_infile'" 4
            echo "could not cd to '$d' in ${dirnames[*]}"
            exit 1
        fi
        cd "$d" || exit 1
    done
    echo "pwd> $(pwd)"
}

####
## Convenience function to regenerate this script from argbash source (*.m4)
do_rebuild_script() {
    echo "Rebuilding script.."
    script_basename=$(basename "$0")
    with_dirs "$script_dir"
    argbash "$script_basename.m4" -c -o "$script_basename"
}

#  pm2 start dist/src/pm2/service-ecosystem.config.js --env=dev && pm2 logs
pm2_start() {
    arg env
    with_dirs 'packages/services'
    readonly ecosystem_config='./dist/src/pm2/service-ecosystem.config.js'
    doit pm2 start $ecosystem_config --env="$env"
    doit pm2 logs
}

pm2_reset() {
    doit pm2 stop all
    doit pm2 flush
    doit pm2 delete all
}

pm2_restart() {
    pm2_reset
    pm2_start
}


# --logs [service]
#  pm2 logs --nostream  --lines 100000
#  pm2 start all
#  pm2 logs
#  pm2 stop all
#  --status
#  pm2 status

# if [ "$download" = on ]; then
#     echo "Downloading Python"
#     download_python
#     unpack_python
# fi


#########################
## Run Main
#########################
parse_commandline "$@"

run_deferred

## Print help if no other action has been taken
_PRINT_HELP=yes die "" 1

# ] <-- needed because of Argbash
