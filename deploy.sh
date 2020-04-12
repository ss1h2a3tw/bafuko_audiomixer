#!/bin/bash
export GENERATE_SOURCEMAP=false
yarn build
cd build
gsutil -m rm -r 'gs://audiomixer.bafuko.moe/*'
gsutil -m cp -r ./* gs://audiomixer.bafuko.moe/
