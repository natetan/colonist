# Repository instructions

These instructions apply throughout this repository.

## Git workflow

- For every task that changes repository files, review the latest `git diff` and `git status --short` before reporting completion. Review `git diff --cached` as well if changes are staged.
- Base the commit message on the actual final diff, including the scope of all files the proposed commands stage.
- In the final response, provide copyable `git add` and `git commit -m` commands with an appropriate message. List specific paths rather than using `git add .`, so unrelated work is not staged.
- Do not commit or push automatically unless the user explicitly requests it. If a requested commit was already made, report its hash and the commands used.
- Preserve unrelated user changes. Do not reset, discard, amend, or rewrite history without explicit authorization.
- For read-only tasks with no changes, state that no commit is needed.

## Project scope

- Build a private, self-hosted multiplayer Settlers-style game. The user tests locally; Azure deployment is a later milestone.
- Prioritize working local gameplay and clear launch instructions. Keep the README accurate about implemented features and limitations.
- The group typically has four or five people and at most ten. Do not assume ten people must play in a single match; confirm larger-match requirements before implementing them.
- Treat investigation findings as evidence, not proof that a complete original game engine or server has been recovered.

## Implementation and verification

- Keep move validation, random outcomes, and authoritative game state on the server. Send each player only information they are allowed to see.
- Design for reconnecting players and saving games as multiplayer implementation develops.
- Run checks appropriate to the change. Game rules, hidden information, and multiplayer state transitions need meaningful tests.
- Report what was checked and any remaining limitations. Do not claim gameplay works without verification.
- Document configuration and commands needed to run locally. Keep secrets out of code and committed files; use an example environment file when configuration is introduced.

## Research files

- Downloaded third-party JavaScript and HTML in `research/` remain local and ignored by Git.
- Commit original analysis and tooling. Do not force-add downloaded bundles or assets without an explicit user request.
- Do not interact with other users' games or accounts during investigation.
