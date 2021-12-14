#!/bin/bash

docker info 2>&1 | grep 'Docker Root Dir' | cut -b 19-
