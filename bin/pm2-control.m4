#!/bin/bash
# shellcheck disable=2154

# Created by argbash-init v2.10.0
# DEFINE_SCRIPT_DIR([_script_dir])
# ARG_OPTIONAL_ACTION([rebuild-script],[],[Rebuild this script (requires argbash installed)],[do_rebuild_script])
# ARG_OPTIONAL_ACTION([reset],[],[stop/flush logs/del all],[pm2_reset])
# ARG_OPTIONAL_ACTION([restart],[],[reset + start],[pm2_restart])
# ARG_OPTIONAL_BOOLEAN([verbose])
# ARG_OPTIONAL_BOOLEAN([dry-run])
# ARG_HELP([PM2 Control], [Wrapper around PM2 start/stop/etc.])
# ARGBASH_SET_INDENT([  ])
# ARGBASH_PREPARE()

# [ <-- needed because of Argbash

# shopt -s extglob
# set -euo pipefail

script_basename=$(basename "$0")

## Assign parsed args to prettier variables
readonly script_dir=$_script_dir
readonly dryrun=$_arg_dry_run
readonly verbose=$_arg_verbose

####
## Run the given command, allowing for --dry-run option to just print the command
doit() {
    local cmds=("$@")
    if [ "$dryrun" = on ]; then
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
    echo "In dir: $(pwd)"
}

####
## Convenience function to regenerate this script from argbash source (*.m4)
do_rebuild_script() {
    echo "Rebuilding script.."
    with_dirs "$script_dir"
    argbash "$script_basename.m4" -c -o "$script_basename"
}


pm2_start() {
    echo pm2 start dist/src/pm2/service-ecosystem.config.js --env=dev
}

pm2_reset() {
    doit pm2 stop all
    doit pm2 flush
    doit pm2 delete all
}

pm2_restart() {
    pm2_reset
}

# --reset
#  pm2 stop all && pm2 flush && pm2 del all

# --start
#  pm2 start dist/src/pm2/service-ecosystem.config.js --env=dev && pm2 logs

# --fresh-start = --reset + --start


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

## Print help if no other action has been taken
_PRINT_HELP=yes die "" 1

# ] <-- needed because of Argbash
