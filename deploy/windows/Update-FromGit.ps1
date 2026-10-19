# Runs on the VM as administrator via Azure Run Command, only on explicit deploy.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$Root,
 [Parameter(Mandatory=$true)][string]$Repository,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9/_-]*$')][string]$Branch,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$Commit,
 [string]$GitSshCommand
)
$ErrorActionPreference='Stop'
$env:GIT_TERMINAL_PROMPT='0'
if($GitSshCommand){$env:GIT_SSH_COMMAND=$GitSshCommand}
if(!(Get-Command git -ErrorAction SilentlyContinue)){throw 'Install Git for Windows and ensure it is available to the Azure VM agent account before deploying.'}
function Git-Checked([string[]]$Arguments){
 # Git writes progress to stderr even on success; Windows PowerShell 5 must
 # judge the exit code rather than treating that stream as a terminating error.
 $previousPreference=$ErrorActionPreference
 try{$ErrorActionPreference='Continue';$output=& git @Arguments 2>&1;$gitExit=$LASTEXITCODE}finally{$ErrorActionPreference=$previousPreference}
 $output|ForEach-Object{Write-Output $_.ToString()}
 if($gitExit -ne 0){throw ('Git failed: '+$Arguments[0])}
}
$Root=[IO.Path]::GetFullPath($Root)
$serviceFile=Join-Path $Root 'services\PrivateSettlersGame.xml'
$originalXml=[IO.File]::ReadAllBytes($serviceFile)
[xml]$service=[Text.Encoding]::UTF8.GetString($originalXml)
$oldApp=[IO.Path]::GetFullPath([string]$service.service.workingdirectory)
$releaseRoot=[IO.Path]::GetFullPath((Join-Path $Root 'releases'))+'\'
if(!$oldApp.StartsWith($releaseRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected active release path'}
$node=[string]$service.service.executable
$npm=Join-Path (Split-Path $node) 'npm.cmd'
if(!(Test-Path -LiteralPath $npm)){throw 'Portable Node/npm runtime missing'}
$env:PATH=(Split-Path $node)+';'+$env:PATH
$source=Join-Path $Root 'source'
if(!(Test-Path -LiteralPath $source)){
 Git-Checked @('clone','--no-checkout','--origin','origin',$Repository,$source)
}
Push-Location $source
try {
 $remote=(& git remote get-url origin).Trim()
 if($LASTEXITCODE -ne 0 -or $remote -ne $Repository){throw 'Source cache remote does not match requested repository'}
 Git-Checked @('fetch','origin',$Branch)
 Git-Checked @('merge-base','--is-ancestor',$Commit,'FETCH_HEAD')
 $id=$Commit.Substring(0,12)+'-'+(Get-Date -Format yyyyMMddHHmmss)
 $checkout=Join-Path $Root ('checkouts\'+$id)
 Git-Checked @('worktree','add','--detach',$checkout,$Commit)
}finally{Pop-Location}
# Ignored renderer assets are installed separately, never pushed into Git.
$renderer=Join-Path $checkout '.rea-tools\renderer'
New-Item -ItemType Directory -Force -Path $renderer | Out-Null
Copy-Item -LiteralPath (Join-Path $oldApp '.rea-tools\renderer\factories.js') -Destination $renderer
Copy-Item -LiteralPath (Join-Path $oldApp '.rea-tools\renderer\assets') -Destination $renderer -Recurse
$output=Join-Path $checkout 'dist\release'
& $node (Join-Path $checkout 'tools\package-windows.cjs') $output
if($LASTEXITCODE -ne 0){throw 'Release packaging failed'}
$release=Join-Path $Root ('releases\'+$id)
Copy-Item -LiteralPath $output -Destination $release -Recurse
Push-Location $release
try {
 & $npm ci --omit=dev --ignore-scripts
 if($LASTEXITCODE -ne 0){throw 'Dependency installation failed'}
 & $node --check (Join-Path $release 'tools\hosted-server.cjs')
 if($LASTEXITCODE -ne 0){throw 'Hosted entry point syntax check failed'}
}finally{Pop-Location}
$stopped=$false
try {
 Stop-Service PrivateSettlersGame
 $stopped=$true
 $backup=Join-Path $Root ('state\backups\'+$id)
 New-Item -ItemType Directory -Force -Path $backup | Out-Null
 Get-ChildItem -LiteralPath (Join-Path $Root 'state') -File -Filter 'games.json*' | Copy-Item -Destination $backup
 [IO.File]::WriteAllBytes((Join-Path $backup 'PrivateSettlersGame.xml'),$originalXml)
 $service.service.workingdirectory=[string]$release
 $service.service.arguments='"'+(Join-Path $release 'tools\hosted-server.cjs')+'"'
 $service.Save($serviceFile)
 Start-Service PrivateSettlersGame
 $healthy=$false
 for($attempt=0;$attempt -lt 15;$attempt++){
  try{if((Invoke-RestMethod http://127.0.0.1:3002/healthz -TimeoutSec 2).ok){$healthy=$true;break}}catch{}
  Start-Sleep -Seconds 1
 }
 if(!$healthy){throw 'New release did not become healthy'}
 [IO.File]::WriteAllText((Join-Path $Root 'state\deployed-commit.txt'),$Commit)
 Write-Output ('DEPLOY_OK '+$Commit)
}catch{
 if($stopped){
  Stop-Service PrivateSettlersGame -ErrorAction SilentlyContinue
  [IO.File]::WriteAllBytes($serviceFile,$originalXml)
  Start-Service PrivateSettlersGame
 }
 throw
}
