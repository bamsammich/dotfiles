#! /usr/bin/env bash
open_github_pr() {
  local repo=$1
  local num=$2
  [[ -z $repo || -z $num ]] && echo "Usage: open_github_pr <repo> <pr_number>" && return 1

  get_git_repo "https://github.com/${repo}"
  gh pr checkout "${num}"
}

get_git_repo() {
  local url=$1
  [[ -z $url ]] && echo "Usage: get_git_repo <url>" && return 1

  [[ $url =~ https://.* ]] || url="$(printf "https://%s" "$url")"
  ghq get --silent "$url"
}

open_git_repo() {
  local url=${1-}
  [[ -z $url ]] && echo "Usage: open_git_repo <url>" && return 1

  get_git_repo "${url}"
  code "${GHQ_ROOT}/${url#"https://"}"
}

export GHQ_ROOT="$(ghq root)"

alias ogpr=open_github_pr
alias ogr=open_git_repo

for bin in {gh,ghq}; do
  if ! command -v $bin &> /dev/null; then
    echo "github.sh: Required binary '$bin' not found"
    return 1
  fi
done
