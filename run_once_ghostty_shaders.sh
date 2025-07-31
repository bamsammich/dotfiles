#! /usr/bin/env bash

dir="${HOME}/.config/ghostty/shaders"

mkdir -p "${dir}/hackr-sh/ghostty-shaders"
git clone https://github.com/hackr-sh/ghostty-shaders "${dir}/hackr-sh/ghostty-shaders"

mkdir -p "${dir}/KroneCorylus/ghostty-shader-playground"
git clone https://github.com/KroneCorylus/ghostty-shader-playground "${dir}/KroneCorylus/ghostty-shader-playground"
