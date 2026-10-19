# Exercise release switching and rollback in a temporary tree with fake Git,
# Node/npm, and service/HTTP boundaries. Does not contact Azure or stop services.
$ErrorActionPreference='Stop'
$update=(Resolve-Path (Join-Path $PSScriptRoot '..\deploy\windows\Update-FromGit.ps1')).Path
$sandbox=Join-Path ([IO.Path]::GetTempPath()) ('settlers-deploy-test-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $sandbox | Out-Null
try {
 foreach($fail in @($false,$true)){
  $root=Join-Path $sandbox ([string]$fail)
  $old=Join-Path $root 'releases\old'
  $bin=Join-Path $root 'bin'
  New-Item -ItemType Directory -Force -Path $old,$bin,(Join-Path $root 'services'),(Join-Path $root 'state'),(Join-Path $old '.rea-tools\renderer\assets')|Out-Null
  Set-Content (Join-Path $old '.rea-tools\renderer\factories.js') 'fixture'
  Set-Content (Join-Path $old '.rea-tools\renderer\assets\fixture.svg') 'fixture'
  Set-Content (Join-Path $root 'state\games.json') '{"private":"preserve"}'
  $node=Join-Path $bin 'fake-node.ps1'
  @'
if($args[0] -eq '--check'){ $global:LASTEXITCODE=0; return }
$target=$args[1]
New-Item -ItemType Directory -Force -Path (Join-Path $target 'tools')|Out-Null
Set-Content (Join-Path $target 'tools\hosted-server.cjs') 'fixture'
$global:LASTEXITCODE=0
'@ | Set-Content $node
  Set-Content (Join-Path $bin 'npm.cmd') '@exit /b 0'
  $xmlPath=Join-Path $root 'services\PrivateSettlersGame.xml'
  $xml='<service><executable>'+[Security.SecurityElement]::Escape($node)+'</executable><workingdirectory>'+[Security.SecurityElement]::Escape($old)+'</workingdirectory><arguments>old</arguments></service>'
  [IO.File]::WriteAllText($xmlPath,$xml)
  $global:qaServiceStops=0;$global:qaServiceStarts=0;$global:qaFailHealth=$fail
  function git {
   $global:LASTEXITCODE=0
   if($args[0] -eq 'clone'){New-Item -ItemType Directory -Force -Path $args[-1]|Out-Null}
   if($args[0] -eq 'remote'){return 'https://github.com/example/game.git'}
   if($args[0] -eq 'worktree'){New-Item -ItemType Directory -Force -Path $args[3]|Out-Null}
  }
  function Stop-Service { param($Name,$ErrorAction) $global:qaServiceStops++ }
  function Start-Service { param($Name) $global:qaServiceStarts++ }
  function Start-Sleep { param($Seconds) }
  function Invoke-RestMethod { param($Uri,$TimeoutSec) if($global:qaFailHealth){throw 'Unhealthy test release'};@{ok=$true} }
  $threw=$false
  try { & $update -Root $root -Repository 'https://github.com/example/game.git' -Branch main -Commit ('a'*40) | Out-Null }catch{if(!$fail){throw};$threw=$true}
  if($threw -ne $fail){throw 'Unexpected deployment result'}
  [xml]$result=Get-Content $xmlPath -Raw
  if($fail){
   if([IO.File]::ReadAllText($xmlPath) -ne $xml){throw 'Rollback did not restore original XML'}
   if($global:qaServiceStarts -ne 2){throw 'Rollback did not restart previous release'}
  }else{
   if($result.service.workingdirectory -eq $old){throw 'New release was not activated'}
   if((Get-Content (Join-Path $root 'state\deployed-commit.txt') -Raw) -ne ('a'*40)){throw 'Wrong deployed commit'}
  }
  if((Get-Content (Join-Path $root 'state\games.json') -Raw).Trim() -ne '{"private":"preserve"}'){throw 'Save was modified'}
  if(!(Get-ChildItem (Join-Path $root 'state\backups') -Recurse -Filter games.json)){throw 'Save backup missing'}
 }
 Write-Output 'PASS: release activation, exact commit receipt, preserved saves, backup, unhealthy-release rollback; no live services touched'
}finally{
 $resolved=[IO.Path]::GetFullPath($sandbox)
 if($resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf).StartsWith('settlers-deploy-test-')){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
