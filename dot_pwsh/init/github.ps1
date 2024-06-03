# Environment Variables
$env:GHQ_ROOT = "$(ghq root)"

# Aliases
Set-Alias -Name g -Value git

# Functions
<#
.SYNOPSIS
    .
.DESCRIPTION
    .
.PARAMETER Path
    .
.PARAMETER LiteralPath
    .
#>
function Open-GitHubPR {
  [Alias("oghpr")]
  [CmdletBinding()]
  param (
    # Github repository to checkout PR from.
    [Parameter(Mandatory, Position=0)]
    [ValidatePattern('.*?/.*')]
    [string]$Repo,
    # Pull request number to checkout.
    [Parameter(Mandatory, Position=1)]
    [int]$Number
  )

  $RepoPath = Get-GitRepo -RepoURL "https://github.com/$Repo"
  if (-not $RepoPath) {
    return
  }
  $currentLocation = $pwd
  Set-Location $RepoPath
  gh pr checkout $Number
  code .
  Set-Location $currentLocation
}

function Confirm-GitRepoExists {
  param (
    # Github repository URL.
    [Parameter(Mandatory, Position = 0)]
    [uri]$RepoURL
  )

  $found = & git ls-remote -h $RepoURL 2>&1
  if ($LASTEXITCODE -ne 0) {
    $message = "Repo not found"
    if ($found) {
      $message += ": $found"
    }
    Write-Error $message
    return $false
  }
  return $true
}

function Get-GitRepo {
  param (
    # Github repository URL.
    [Parameter(Mandatory, Position = 0)]
    [uri]$RepoURL
  )

  if (-not $RepoURL.Scheme) {
    $RepoURL = "https://$($RepoURL.OriginalString)"
  }

  $exists = Confirm-GitRepoExists -RepoURL $RepoURL
  if (-not $exists) {
    return
  }

  $RepoPath = "$env:GHQ_ROOT/$($RepoURL.Host)$($RepoURL.AbsolutePath)"
  if (!(Get-Item $RepoPath -ErrorAction SilentlyContinue)) {
    ghq get $RepoURL
  }
  return $RepoPath
}

function Open-GitRepoInVSCode {
  [Alias("ogrvsc")]
  param (
    # Github repository URL.
    [Parameter(Mandatory, Position = 0)]
    [uri]$RepoURL
  )
  $RepoPath = Get-GitRepo $RepoURL
  if (-not $RepoPath) {
    return
  }
  code "$RepoPath"
}

$requiredBinaries = @(
  "ghq",
  "gh",
  "code",
  "git"
)

foreach ($bin in $requiredBinaries) {
  if (!(Get-Command -Name $bin -ErrorAction SilentlyContinue)) {
    Write-Error "Missing required binary: $bin"
  }
}

