[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$BundlePath,
  [Parameter(Mandatory=$true)][string]$Root,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9][a-z0-9.-]+[a-z0-9]$')][string]$Hostname,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$Release
)
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root)
$BundlePath = (Resolve-Path -LiteralPath $BundlePath).Path
if (Get-Service PrivateSettlersGame,PrivateSettlersHttps -ErrorAction SilentlyContinue) { throw 'Services already exist; use the documented update procedure.' }
if (Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -in 443,3002) { throw 'Port 443 or 3002 is already in use.' }
$app = Join-Path $Root "releases\$Release"
if (Test-Path -LiteralPath $app) { throw 'Release already exists.' }
$state = Join-Path $Root 'state'
$bin = Join-Path $Root 'bin'
$services = Join-Path $Root 'services'
$logs = Join-Path $state 'logs'
New-Item -ItemType Directory -Force -Path $app,$bin,$services,$logs | Out-Null
Copy-Item -LiteralPath (Join-Path $BundlePath 'app') -Destination $app -Recurse
# Copy-Item creates an app child when destination already exists.
$app = Join-Path $app 'app'
Expand-Archive -LiteralPath (Join-Path $BundlePath 'node.zip') -DestinationPath $bin
Expand-Archive -LiteralPath (Join-Path $BundlePath 'caddy.zip') -DestinationPath (Join-Path $bin 'caddy')
$nodeDir = (Get-ChildItem -LiteralPath $bin -Directory -Filter 'node-v*-win-x64' | Select-Object -First 1).FullName
$node = Join-Path $nodeDir 'node.exe'
$caddy = Join-Path $bin 'caddy\caddy.exe'
$env:PATH = $nodeDir + ';' + $env:PATH
Push-Location $app
try { & (Join-Path $nodeDir 'npm.cmd') ci --omit=dev --ignore-scripts; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' } } finally { Pop-Location }
& (Join-Path $BundlePath 'Configure-Host.ps1') -Hostname $Hostname -AppPath $app -StatePath $state
& $caddy validate --config (Join-Path $state 'Caddyfile') --adapter caddyfile
if ($LASTEXITCODE -ne 0) { throw 'Caddy validation failed' }
function Escape-Xml([string]$value) { [System.Security.SecurityElement]::Escape($value) }
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($service in @(
  @{Name='PrivateSettlersGame'; Executable=$node; Arguments=('"' + (Join-Path $app 'tools\hosted-server.cjs') + '"'); Environment=('<env name="SETTLERS_CONFIG" value="' + (Escape-Xml (Join-Path $state 'host.json')) + '"/>')},
  @{Name='PrivateSettlersHttps'; Executable=$caddy; Arguments=('run --config "' + (Join-Path $state 'Caddyfile') + '" --adapter caddyfile'); Environment=''}
)) {
  $name = $service.Name
  Copy-Item -LiteralPath (Join-Path $BundlePath 'WinSW.exe') -Destination (Join-Path $services "$name.exe")
  $exe = Escape-Xml $service.Executable
  $arguments = Escape-Xml $service.Arguments
  $log = Escape-Xml $logs
  $working = Escape-Xml $app
  $xml = @"
<service>
 <id>$name</id><name>$name</name>
 <description>Private Settlers hosting</description>
 <executable>$exe</executable><arguments>$arguments</arguments>
 <workingdirectory>$working</workingdirectory>
 $($service.Environment)
 <serviceaccount><domain>NT AUTHORITY</domain><user>LocalService</user></serviceaccount>
 <startmode>Automatic</startmode><stoptimeout>20sec</stoptimeout>
 <onfailure action="restart" delay="10 sec"/>
 <logpath>$log</logpath><log mode="roll"><sizeThreshold>10240</sizeThreshold><keepFiles>4</keepFiles></log>
</service>
"@
  [IO.File]::WriteAllText((Join-Path $services "$name.xml"), $xml, $utf8)
}
# Restrict private saves/certificates to administrators, SYSTEM, and LocalService.
& icacls.exe $Root /grant '*S-1-5-19:(OI)(CI)RX' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Root ACL failed' }
& icacls.exe $state /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-19:(OI)(CI)M' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'State ACL failed' }
foreach ($name in 'PrivateSettlersGame','PrivateSettlersHttps') {
  & (Join-Path $services "$name.exe") install
  if ($LASTEXITCODE -ne 0) { throw "Service installation failed: $name" }
  $installed = Get-CimInstance Win32_Service -Filter "Name='$name'"
  if ($installed.StartName -ne 'NT AUTHORITY\LocalService') { throw "Unexpected service identity: $name" }
}
New-NetFirewallRule -Name PrivateSettlersHttps -DisplayName 'Private Settlers HTTPS' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -Program $caddy | Out-Null
Start-Service PrivateSettlersGame
Start-Service PrivateSettlersHttps
Start-Sleep -Seconds 3
$health = Invoke-RestMethod http://127.0.0.1:3002/healthz -TimeoutSec 10
if (!$health.ok) { throw 'Game health check failed' }
Get-Service PrivateSettlersGame,PrivateSettlersHttps | Select-Object Name,Status
Write-Output 'Game healthy. Verify public HTTPS and existing IW5 FastDL separately.'
