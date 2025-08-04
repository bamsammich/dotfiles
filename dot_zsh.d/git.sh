#! /usr/bin/env bash

func git_open() {
  set -x

  is_repo="$(git rev-parse --is-inside-work-tree)"
  exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    return $exit_code
  fi

  if [[ is_repo ]]; then
    open "$(git config --get remote.origin.url)"
  fi
  set +x
}
