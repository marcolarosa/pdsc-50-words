#!/bin/bash

apt-get update && apt-get install -y ffmpeg
pip install xlrd coloredlogs
python3 --version
wget --quiet -O ${DATA_50WORDS}/gambay-languages.geojson https://gambay.com.au/gambay-languages.geojson
python3 -u ./bin/extract-data.py