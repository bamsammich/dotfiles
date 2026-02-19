#!/bin/sh

# exit immediately if 1password binary is already in $PATH
type op >/dev/null 2>&1 && exit

case "$(uname -s)" in
Darwin)
  brew install 1password 1password-cli
  ;;
Linux)
  if command -v yay >/dev/null 2>&1; then
    yay -S --needed --noconfirm 1password 1password-cli
  else
    echo "no supported package manager found for Linux"
  fi
  ;;
*)
  echo "unsupported OS"
  exit 1
  ;;
esac

