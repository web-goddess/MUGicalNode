#!/usr/bin/env bash

set -e
set -x

mkdir -p dist
npm install --prune
cp -r node_modules dist
cp -r src/. dist
rm -rf dist.zip
cd dist
zip -9r ../dist.zip *
cd ..

aws lambda update-function-code \
--function-name MUGicalNode \
--zip-file fileb://dist.zip \
--publish
