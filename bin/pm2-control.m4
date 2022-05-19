#!/bin/bash
# shellcheck disable=2154
#
# ARGBASH_SET_INDENT([  ])
# DEFINE_SCRIPT_DIR([_script_dir])
#
# ARG_OPTIONAL_BOOLEAN([verbose])
# ARG_OPTIONAL_BOOLEAN([dry-run], [])
#
# ARG_OPTIONAL_SINGLE([env], [], [Env Mode; Required], [unspecified])
# ARG_TYPE_GROUP_SET([envmode], [ENVMODE], [env], [dev,test,prod], [])
#
# ARG_OPTIONAL_ACTION([start],[],[Start pm2 with *-ecosystem.config],[pm2_start])
# ARG_OPTIONAL_ACTION([reset],[],[stop/flush logs/del all],[pm2_reset])
# ARG_OPTIONAL_ACTION([restart],[],[reset + start],[pm2_restart])
#
# ARG_HELP([PM2 Control], [Wrapper around PM2 start/stop/etc.])
#
# ARGBASH_PREPARE()
#
# [ <-- needed because of Argbash
readonly script_dir="$_script_dir"

source "$script_dir/_utils.sh"

pm2_start() {
    arg env
    with_dirs 'packages/services'
    readonly ecosystem_config="./dist/src/pm2/${env}-ecosystem.config.js"
    test -f "$ecosystem_config" || die "pm2 config $ecosystem_config does not exist"
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
#  pm2 logs
#  pm2 status

#########################
## Run Main
#########################
parse_commandline "$@"

## Print help if no other action has been taken
_PRINT_HELP=yes die "" 1

# ] <-- needed because of Argbash
