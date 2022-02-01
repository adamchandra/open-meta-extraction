#!/bin/bash

declare -a dirs=(
   commlinks
   commonlib
   field-extractors
   root
   services
   spider
)

for i in "${dirs[@]}"
do
   cd "$i"
   ncu -ui
   cd ..
done
