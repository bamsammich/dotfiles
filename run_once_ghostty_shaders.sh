#! /usr/bin/env bash

dir="${HOME}/.config/ghostty/shaders"

mkdir -p "${dir}"
git clone https://github.com/hackr-sh/ghostty-shaders "${dir}"
