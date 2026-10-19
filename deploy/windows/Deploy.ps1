[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$ResourceGroup,
 [Parameter(Mandatory=$true)][string]$VmName,
 [string]$Root='C:\gameserver\PrivateSettlers',
 [string]$ServerRepository='https://github.com/natetan/colonist.git',
 [string]$GitSshCommand,
 [switch]$Plan
)
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $repoRoot
try {
 $status=& git status --porcelain
 if($LASTEXITCODE -ne 0){throw 'Git status failed'}
 if($status){throw 'Commit your changes first. Deployment requires a clean working tree.'}
 $branch=(& git branch --show-current).Trim()
 $commit=(& git rev-parse HEAD).Trim()
 if(!$branch -or $branch -notmatch '^[a-zA-Z0-9][a-zA-Z0-9/_-]*$'){throw 'Check out a named branch before deploying'}
 if($commit -notmatch '^[a-f0-9]{40}$'){throw 'Unable to resolve commit'}
 if($Plan){Write-Output "Would test and push origin/$branch, then deploy commit $commit to the selected VM. No changes made.";return}
 foreach($command in 'node','git','az'){Get-Command $command -ErrorAction Stop | Out-Null}
 foreach($test in 'tests/server.cjs','tests/renderer-menu.cjs','tests/hosting.cjs'){
  & node $test
  if($LASTEXITCODE -ne 0){throw "Local check failed: $test"}
 }
 & git push origin "HEAD:refs/heads/$branch"
 if($LASTEXITCODE -ne 0){throw 'Push failed; VM was not changed'}
 $state=& az vm get-instance-view -g $ResourceGroup -n $VmName --query "instanceView.statuses[?code=='PowerState/running'].code" -o tsv
 if($LASTEXITCODE -ne 0 -or $state -ne 'PowerState/running'){throw 'VM must already be running; no automatic power change was made'}
 # Encode the reviewed server script so parameter values remain data, not shell code.
 $payload=@{Root=$Root;Repository=$ServerRepository;Branch=$branch;Commit=$commit;GitSshCommand=$GitSshCommand}|ConvertTo-Json -Compress
 $payloadEncoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload))
 $scriptEncoded=[Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'Update-FromGit.ps1')))
 $bootstrap=@"
`$ErrorActionPreference='Stop'
`$values=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$payloadEncoded'))|ConvertFrom-Json
`$parameters=@{}
`$values.PSObject.Properties|ForEach-Object{`$parameters[`$_.Name]=`$_.Value}
`$script=[ScriptBlock]::Create([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$scriptEncoded')))
& `$script @parameters
"@
 $temporary=Join-Path ([IO.Path]::GetTempPath()) ('settlers-deploy-'+[Guid]::NewGuid().ToString('N')+'.ps1')
 try{
  [IO.File]::WriteAllText($temporary,$bootstrap,(New-Object Text.UTF8Encoding($false)))
  $result=& az vm run-command invoke -g $ResourceGroup -n $VmName --command-id RunPowerShellScript --scripts "@$temporary" --query 'value[].message' -o tsv
  $azureExit=$LASTEXITCODE
  $result|Write-Output
  if($azureExit -ne 0 -or ($result -join "`n") -notmatch ('DEPLOY_OK '+$commit)){throw 'VM deployment failed; review the output. A failed release switch attempts to restore the previous service configuration.'}
 }finally{if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary}}
}finally{Pop-Location}
