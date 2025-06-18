#!/bin/sh

# exit immediately if 1password binary is already in $PATH
type op >/dev/null 2>&1 && exit

case "$(uname -s)" in
Darwin)
  brew install 1password 1password-cli
  ;;
Linux)
  echo "no password manager defined for Linux"
  ;;
*)
  echo "unsupported OS"
  exit 1
  ;;
esac

