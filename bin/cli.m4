#!/bin/bash
# shellcheck disable=2154
#
# ARGBASH_SET_INDENT([  ])
# DEFINE_SCRIPT_DIR([_script_dir])
#
# ARG_OPTIONAL_BOOLEAN([dry-run], [])
#
# ARG_OPTIONAL_SINGLE([env], [], [Env Mode; Required], [unspecified])
# ARG_TYPE_GROUP_SET([envmode], [ENVMODE], [env], [dev,test,prod], [])
# ARG_LEFTOVERS()
# ARG_HELP([RunCLI], [Run a command line app])
#
# ARGBASH_GO()
#
# [ <-- needed because of Argbash
readonly script_dir="$_script_dir"
source "$script_dir/_utils.sh"

readonly climain="./packages/services/dist/src/cli"
arg env

export NODE_ENV="$env"
doit node "$climain" "${_arg_leftovers[@]}"

# ] <-- needed because of Argbash
