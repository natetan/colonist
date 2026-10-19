# Existing Windows VM deployment

The existing Windows VM has been deployed and checked over public HTTPS. Keep
IIS/FastDL on port 80. The hostname is an Azure public-IP DNS label; retrieve its
current value from Azure rather than committing resource identifiers here.
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

## Install on the VM

`Install-Host.ps1` installs a fresh host using a private bundle containing `app/`,
`node.zip`, `caddy.zip`, `WinSW.exe`, and `Configure-Host.ps1`. Verify downloaded
runtime checksums and the complete transfer archive before executing it. Pass
`-BundlePath`, `-Root`, `-Hostname`, and a new `-Release` name. It refuses existing
services and occupied ports, validates Caddy, installs automatic LocalService
services, restricts private state ACLs, and opens only Caddy's TCP 443 in Windows
Firewall. Azure DNS/NSG changes are separate explicit operations.

The initial deployment uses Node 24.22.0, Caddy 2.11.6, and WinSW 2.12.0. Node's
SHA256 and Caddy's SHA512 were compared to their official release checksums;
the WinSW binary was downloaded from its official GitHub release over HTTPS.
The private archive's SHA256 was checked on the VM before extraction.

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

## Operations and verification

### Explicit deployment from Git

Local editing, committing, and ordinary pushes do not update the VM. No polling,
scheduled pull, Git hook, or automatic GitHub deployment is configured. Changes
made with the assistant stay local unless deployment is explicitly requested.

Commit the changes you want to release, then run this from the local repository:

```powershell
.\deploy\windows\Deploy.ps1 -ResourceGroup '<resource-group>' -VmName '<vm-name>'
```

Use a supported Node runtime and sign in with `az login` first. The script checks
that the working tree is clean, runs local server/menu/hosting checks, pushes
the current branch to `origin`, and asks the already-running VM to fetch the
exact commit. It never commits files or starts a stopped VM. `-Plan` prints the
selected branch/commit without tests, push, Azure calls, or VM changes (a clean
working tree is still required).

The VM builds a new versioned release from that commit, reuses the installed
ignored renderer assets, installs locked dependencies, then briefly stops only
`PrivateSettlersGame`. It backs up saves, switches the service to the new release,
and checks local health. A failed switch restores the old service configuration
and starts the previous release. Caddy, HTTPS/DNS, IW5, and the state directory
remain separate. Existing clients may briefly disconnect and reconnect.

The wrapper requires the `DEPLOY_OK <commit>` receipt from the remote script;
an Azure Run Command exit code alone does not establish a successful deployment.
Old releases, checkouts, and private save backups are retained for recovery; clean
them up deliberately as disk usage grows. Rollback restores app code, not data:
future changes to save formats need an explicit migration/rollback plan.

#### One-time Git access on the VM

Install Git for Windows so the Azure agent's account can run `git`. Public repos
can use the default HTTPS URL. Private repos require a **read-only GitHub deploy
key**: generate an SSH key as the VM administration account, restrict its private
key ACL to administrators/SYSTEM, add only its public key in the repository's
Settings → Deploy keys, and verify GitHub's SSH host key against its official
published fingerprints. Do not disable host-key checking. Keep the key outside
the app/state directories and out of Git. The game services need no Git access.

Then deploy using the SSH URL and a VM-local SSH configuration:

```powershell
.\deploy\windows\Deploy.ps1 -ResourceGroup '<resource-group>' -VmName '<vm-name>' -ServerRepository 'git@github.com:natetan/colonist.git' -GitSshCommand 'ssh -F C:/ProgramData/SettlersDeploy/ssh_config'
```

Do not pass a GitHub password or token in either URL or command. No Git credentials
or live VM configuration are committed here. This new Git update workflow has
been tested with isolated service/Git fixtures; it has **not yet been run against
the live VM**. Its first invocation needs the one-time Git access check above.
Run `powershell -File tests/deploy-windows.ps1` to exercise release activation,
save preservation/backups, and unhealthy-release rollback without live services.

Services are `PrivateSettlersGame` and `PrivateSettlersHttps`, both automatic and
running as `NT AUTHORITY\LocalService`. Their WinSW executable/XML pairs live in
`<Root>\services`; logs and saves live in `<Root>\state`. Use elevated PowerShell:

```powershell
Get-Service PrivateSettlersGame,PrivateSettlersHttps
Restart-Service PrivateSettlersGame
Stop-Service PrivateSettlersGame,PrivateSettlersHttps
Start-Service PrivateSettlersGame,PrivateSettlersHttps
```

Run the external smoke test from this repository:

```powershell
node tests/hosted-smoke.cjs 'https://<your-hostname>'
```

It checks HTTPS assets, secure WebSockets, two-human setup, renderer state, and
seat reconnect, and removes its QA room. It does not claim full browser/animation
or full-match verification. The existing IW5 FastDL health endpoint was checked
before and after installation. IW5 binaries, configuration, startup setup, and
UDP/RDP/HTTP rules are preserved; an IW5 client match has not been run as part
of this deployment. Temporary private transfer storage is deleted afterward.

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
