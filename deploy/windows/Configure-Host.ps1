# Generates configuration only. Does not install services or change firewall/Azure.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9][a-z0-9.-]+[a-z0-9]$')][string]$Hostname,
  [Parameter(Mandatory=$true)][string]$AppPath,
  [Parameter(Mandatory=$true)][string]$StatePath,
  [ValidateRange(1024,65535)][int]$Port = 3002
)
$ErrorActionPreference = 'Stop'
$AppPath = [IO.Path]::GetFullPath($AppPath)
$StatePath = [IO.Path]::GetFullPath($StatePath)
if ($StatePath -eq $AppPath -or $StatePath.StartsWith($AppPath.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'StatePath must be outside AppPath so releases cannot overwrite saves/certificates.'
}
if (!(Test-Path -LiteralPath (Join-Path $AppPath 'tools\hosted-server.cjs'))) { throw 'AppPath is not a packaged game directory.' }
New-Item -ItemType Directory -Force -Path $StatePath | Out-Null
$configFile = Join-Path $StatePath 'host.json'
$caddyFile = Join-Path $StatePath 'Caddyfile'
if ((Test-Path -LiteralPath $configFile) -or (Test-Path -LiteralPath $caddyFile)) { throw 'Configuration exists. Review/edit it rather than overwriting it.' }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$config = @{ publicOrigin = "https://$Hostname"; port = $Port; saveFile = (Join-Path $StatePath 'games.json') } | ConvertTo-Json
[IO.File]::WriteAllText($configFile, $config, $utf8)
$storage = (Join-Path $StatePath 'certificates').Replace('\','/')
$caddy = @"
{
    admin off
    auto_https disable_redirects
    storage file_system {
        root "$storage"
    }
}
https://$Hostname {
    tls {
        issuer acme {
            disable_http_challenge
        }
    }
    reverse_proxy 127.0.0.1:$Port
}
"@
[IO.File]::WriteAllText($caddyFile, $caddy, $utf8)
Write-Output "Prepared $configFile and $caddyFile. No services or network settings changed."
