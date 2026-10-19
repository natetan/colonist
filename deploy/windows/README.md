# Existing Windows VM deployment

Preparation is local; the VM has not been deployed. Keep IIS/FastDL on port 80.
Use an Azure public-IP DNS label, giving a hostname such as
`<label>.<region>.cloudapp.azure.com`. The actual resource names and address are
runtime inputs, never committed configuration.

## Build the private release locally

Use a supported Node LTS runtime (Node 24 recommended), then:

```powershell
node tools/package-windows.cjs dist/windows-release
Compress-Archive -Path dist/windows-release/* -DestinationPath dist/windows-release.zip
Get-FileHash dist/windows-release.zip -Algorithm SHA256
```

Choose a new release directory each time. The package contains only game source,
the lockfile, required audio, and local renderer assets with hashed filenames.
It excludes saves, account configuration, research pages, diagnostic scripts,
and node_modules. Keep this private archive out of Git. Renderer assets must
already have been prepared locally using the README's renderer commands.

## Install on the VM (pending live verification)

Copy/extract the private release into a versioned directory such as
`C:\gameserver\PrivateSettlers\releases\<version>`; verify its archive SHA256
against the local value before extraction. Install a supported Node LTS runtime
and the official Windows Caddy binary. In the release directory run
`npm ci --omit=dev`. Do not copy a local save unless intentionally migrating it.

Generate configuration once, using the VM's chosen hostname:

```powershell
.\Configure-Host.ps1 -Hostname '<label>.<region>.cloudapp.azure.com' -AppPath 'C:\gameserver\PrivateSettlers\releases\<version>' -StatePath 'C:\gameserver\PrivateSettlers\state'
$env:SETTLERS_CONFIG = 'C:\gameserver\PrivateSettlers\state\host.json'
node 'C:\gameserver\PrivateSettlers\releases\<version>\tools\hosted-server.cjs'
```

In another terminal validate and run the proxy:

```powershell
caddy validate --config 'C:\gameserver\PrivateSettlers\state\Caddyfile' --adapter caddyfile
caddy run --config 'C:\gameserver\PrivateSettlers\state\Caddyfile' --adapter caddyfile
```

This config uses only HTTPS/443 and TLS-ALPN certificate validation, leaving IIS
on 80. DNS must resolve to the VM, and inbound TCP 443 must be permitted in both
the Azure NSG and Windows Firewall. Node stays bound to 127.0.0.1:3002; do not
open that port externally. Check `/healthz` locally and over HTTPS, then verify
two separate browsers can join, trade, reconnect, and resume after restart.
Check the existing FastDL health URL still works.

## Remaining deployment steps

After authorization to start/reconfigure the VM: inspect its installed Node,
IIS bindings, IW5 startup mechanism, and available ports; choose/check the DNS
label; install and verify the runtimes; add only the required HTTPS rules.
Configure automatic startup with separate Node and Caddy services using an
unprivileged service account, read access to releases, and write access only to
the state/log directories. Service installation and switching are deliberately
pending inspection of the live VM; no generic process-killing script is supplied.

Stop only the Settlers service before switching to the existing IW5 launcher.
Do not deallocate the VM while friends need the web game. For updates, stop the
game, back up the state directory, install into a new release directory, update
the service executable arguments, and restart/health-check. Keep the previous
release for rollback. Saves contain hidden hands and reconnect tokens: restrict
their ACLs and keep backups private. Current hosting has room codes but no
site-wide login/invite gate, so knowing the public hostname allows creating rooms.

References: [Caddy on Windows](https://caddyserver.com/docs/running),
[Caddy HTTPS options](https://caddyserver.com/docs/caddyfile/options),
[TLS issuer configuration](https://caddyserver.com/docs/caddyfile/directives/tls).
