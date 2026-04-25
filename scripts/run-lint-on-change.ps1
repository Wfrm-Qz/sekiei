<#
Collect changed files from git status and pass them to the Node runner as
explicit file arguments. The actual lint and format routing stays in the
Node script so the workflow remains repo-local and predictable on Windows.
#>

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$nodeScript = Join-Path $repoRoot "scripts\run-lint-on-change.mjs"

Set-Location $repoRoot

$changedFiles = @()
git status --short --untracked-files=all | ForEach-Object {
  if ([string]::IsNullOrWhiteSpace($_)) {
    return
  }

  $path = $_.Substring(3)
  if ($path -match " -> ") {
    $path = ($path -split " -> ")[-1]
  }

  if (-not [string]::IsNullOrWhiteSpace($path)) {
    $changedFiles += $path
  }
}

if ($changedFiles.Count -eq 0) {
  Write-Output "[lint-on-change] No changed files were found."
  exit 0
}

& node $nodeScript --files @changedFiles
exit $LASTEXITCODE
