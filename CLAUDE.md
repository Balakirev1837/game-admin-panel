# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

```bash
npm install --omit=dev   # Install on host (not inside Docker)
npm test                 # 397 tests, 29 suites (uses --forceExit)
```

Docker build copies host `node_modules` into the image (no `npm install` inside Docker due to Ubuntu DNS issues):

```bash
docker compose build admin-panel
docker compose up -d admin-panel
```

## Architecture Overview

**Monolithic Node.js + Express app** serving a static frontend (Tailwind CSS). No build step.

- **Backend**: Express routes in `src/routes/`, services in `src/services/`, per-game adapters in `src/games/`
- **Frontend**: `public/app.js` (~2400 lines, 14 sections) + `public/utils.js`, served statically
- **Docker**: Mounts `/var/run/docker.sock` (Dockerode) and host game directory at `/host-games`
- **Auth**: Bearer-token-only, in-memory store, enabled via `ADMIN_PASSWORD` env var
- **Logging**: `pino` + `pino-http`, silent at `fatal` level in test env

### Key Architecture Patterns

- **Per-game adapters** (`src/games/`): Registry pattern. Each game exports `readConfig`, `writeConfig`, `validateConfig`, `resolveRcon`, `resolveRest`, `getPlayers`, `configFields`, `quickCommands`, `gameDataTypes`. Routes delegate to adapters.
- **RCON pooling** (`src/services/rconPool.js`): `Map` of connections keyed by `host:port`, 60s idle timeout, auto-evict on auth failure.
- **Server-side cache**: Container list cache (1.5s TTL) in `containers.js`, invalidated on Docker events via `onEvent` callback from `events.js`. Disk stats cache (30s TTL) in `host.js`.
- **SSE events**: Docker event stream → SSE to frontend + `onEvent` callbacks for cache invalidation + ntfy.sh notifications.
- **Config diff & backup**: Auto-backup before every config save. Diff modal shown for confirmation. Retention configurable.

## Conventions & Patterns

- **Version bump**: Every push that changes code MUST bump `VERSION` (semver in repo root). Patch=bugfix, Minor=feature, Major=breaking.
- **No comments in code** unless explicitly requested.
- **Non-interactive shell flags**: Always use `cp -f`, `rm -rf`, `mv -f` etc.
- **Test mocks**: Logger mocks need `child()` method: `const m = { info, warn, error, fatal }; m.child = () => m;`
- **Test env vars**: Tests that set `process.env.GAME_CONFIG_ROOT` must do so BEFORE requiring `src/index` (scheduler/snapshots capture at module load).
- **`jest.resetModules()`**: Avoid in integration tests that require the full app — causes logger mock mismatch.
- **`API_BASE`**: Frontend uses `const API_BASE = '/api/containers'` — do not remove.
- **`docker.getEvents()`**: Returns a Promise — `startEventListener` must `await` it.
- **`NTFY_TOPIC`**: Must be declared in any module that uses it (events.js, scheduler.js each have their own).
- **Dockerfile**: Runs as root (not `nodeuser`) — nodeuser can't access Docker socket.
- **Path traversal protection**: `prospects.js` rejects names containing `..`, `/`, `\`.
