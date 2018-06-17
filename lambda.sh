#!/usr/bin/env bash

set -e
set -x

if [ "$#" -ne 1 ]; then
  echo "Usage : ./build.sh lambdaName";
  exit 1;
fi

lambda=${1%/}; // # Removes trailing slashes
echo "Deploying $lambda";
cd $lambda;
if [ $? -eq 0 ]; then
  echo "...."
else
  echo "Couldn't cd to directory $lambda. You may have mis-spelled the lambda/directory name";
  exit 1
fi

mkdir -p dist

echo "npm installing...";
npm install --prune
if [ $? -eq 0 ]; then
  echo "done";
else
  echo "npm install failed";
  exit 1;
fi

cp -r node_modules dist
cp -r src/original/. dist
cp src/secrets.json dist

echo "removing old zip"
rm -rf dist.zip
cd dist

echo "creating a new zip file"
zip -9r ../dist.zip *
cd ..

echo "Uploading $lambda...";
aws lambda update-function-code \
--function-name MUGicalNode \
--zip-file fileb://dist.zip \
--publish

if [ $? -eq 0 ]; then
  echo "!! Upload successful !!"
else
  echo "Upload failed"
  echo "If the error was a 400, check that there are no slashes in your lambda name"
  echo "Lambda name = $lambda"
  exit 1;
fi
