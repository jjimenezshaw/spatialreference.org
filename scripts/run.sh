#!/usr/bin/env bash
set -Eeuo pipefail

# indicate DOCKER PROJ version
PROJ_VERSION=9.6.2
PYPROJ_VERSION=3.7.1
LAST_REVISED=2025
TAG="crs-explorer:$PROJ_VERSION"
STOP_COUNTER="${1:-0}"

# prepare destination
DIRNAME=`dirname $(readlink -f $0)`
mkdir -p $DIRNAME/dist
test "$(ls -A $DIRNAME/dist/)" && rm -r $DIRNAME/dist/*

# build container
docker build --pull --platform=linux/amd64 --build-arg VERSION=$PROJ_VERSION --build-arg PYPROJ_VERSION=$PYPROJ_VERSION --tag $TAG $DIRNAME

# execute container
docker run --user $(id -u):$(id -g) -e STOP_COUNTER=$STOP_COUNTER -e LAST_REVISED=$LAST_REVISED -e PROJ_VERSION=$PROJ_VERSION --rm -v "$DIRNAME/dist:/home/dist" $TAG

# done
echo .
echo Enjoy the generated code at $DIRNAME/dist/
