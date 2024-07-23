function Remove-GitMergedBranches {
  git fetch -p

  $branches = git for-each-ref --format '%(refname) %(upstream:track)' refs/heads | `
    Where-Object { $_ -match "refs/heads/(.*)\s?\[gone\]" } | `
    ForEach-Object { $matches[1].Trim() }
  foreach ($branch in $branches) {
    git branch -D $branch
  }
}

Set-Alias -Name rgmb -Value Remove-GitMergedBranches
