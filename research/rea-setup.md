# REA for Colonist

The REA source repository is cloned at `C:\Users\nytan\Documents\rea`. The verified executable is the published **rea-agents 6.4.0** package installed separately under this project's ignored `.rea-tools` directory. The source checkout does not need to be built to use that package.

The normal Node installation is 16.14.0, below REA's supported versions. REA is registered with Codex using the existing bundled Node **24.19.0**, without changing the system Node installation. npm installed the package with scripts and optional dependencies omitted; native capabilities have not been verified.

Setup added the `rea` MCP integration to `C:\Users\nytan\.codex\config.toml`, backed up that file through REA's installer, and installed its workflow under `C:\Users\nytan\.agents\skills\reverse-engineer-anything`. Setup reported `ready`. Restart Codex to load the new MCP integration and skill. This is an application restart, not a Windows restart.

## Analyze the existing bundles

```powershell
npm run inspect:rea
```

This statically analyzes the `research` directory without executing downloaded scripts. The report is saved at `.rea-tools/colonist-analysis.json`. It may contain extracted third-party code and stays ignored. REA setup results are also kept locally in `.rea-tools/setup-result.json`.

The first run produced a valid JSON evidence report of 90,987,850 bytes. REA explicitly reported incomplete graph coverage and resource constraints; this is partial analysis, not a complete recovered application. Prefer smaller targeted artifact/module analyses for further investigation. Do not print the whole report into the terminal or chat.

The wrapper uses Codex's bundled Node path by default; set `REA_NODE` to another supported Node executable if that location changes. REA currently requires Node 22.19+ in the 22.x line, 24.11+ in the 24.x line, or 26+.

## Reinstall on this machine

```powershell
npm install --prefix .rea-tools rea-agents@6.4.0 --ignore-scripts --omit=optional
```

The older npm executable may print engine warnings. The analysis wrapper explicitly runs the supported Node runtime. No native decompiler is needed for this static JavaScript workflow.

## Investigation scope

Start with the downloaded browser bundles: map webpack modules, rules execution versus validation, bot implementations, and the client/server boundary. Static analysis does not recover undistributed server code. Browser attachment and live network inspection have not been configured or verified by this setup; those require a separately scoped browser connection. Keep the current original prototype while evaluating which recovered components are useful.
