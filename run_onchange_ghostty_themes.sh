#! /usr/bin/env bash

tmp_dir=$HOME/.config/ghostty/tmp
theme_dir=$HOME/.config/ghostty/themes

mkdir -p "${tmp_dir}"
mkdir -p "${theme_dir}"

mkdir -p "${tmp_dir}/EastSun5566/ghostty-noctis-themes"
git clone https://github.com/eastsun5566/ghostty-noctis-themes.git "${tmp_dir}/EastSun5566/ghostty-noctis-themes"
cp $tmp_dir/EastSun5566/ghostty-noctis-themes/themes/* $theme_dir/

mkdir -p "${tmp_dir}/catppuccin/ghostty"
git clone https://github.com/catppuccin/ghostty.git "${tmp_dir}/catppuccin/ghostty"
cp $tmp_dir/catppuccin/ghostty/* $theme_dir/

rm -rf $tmp_dir
