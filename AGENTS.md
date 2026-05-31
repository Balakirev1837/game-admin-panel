# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Build & Deploy

```bash
# Dependencies must be installed on the HOST, not inside Docker.
# Docker bridge DNS on Ubuntu + systemd-resolved causes npm install
# to hang with EAI_AGAIN. The Dockerfile COPYs node_modules from host.
npm install --omit=dev
npm test                 # MUST pass before push

# Build image (no network needed — node_modules is baked in)
docker compose build admin-panel
docker compose up -d admin-panel
```

## Container Communication Architecture

The panel communicates with game containers through **four distinct methods**, each used for specific purposes. Understanding which method applies to which game is critical for making correct changes.

### Method 1: Docker Daemon API (via Dockerode + socket)

The panel mounts `/var/run/docker.sock` and uses the Dockerode library. This is the primary communication channel.

| Docker API method | Used by | Notes |
|---|---|---|
| `docker.listContainers()` | Container list | Filters by `game-admin-panel.enabled=true` label |
| `container.inspect()` | Config, RCON, players, events | Returns `Config.Env`, `Config.Labels`, `NetworkSettings`, `State` |
| `container.logs()` | Logs viewer | Returns framed stream (8-byte headers) or plain text for TTY containers |
| `container.stats({stream:false})` | Resource monitor | Single-shot CPU/memory/network stats |
| `container.start()` / `.stop()` / `.restart()` | Start/stop/restart | Direct lifecycle control |
| `docker.getEvents()` | SSE event stream | Container lifecycle events (start, die, etc.) |

**Labels used on game containers:**
- `game-admin-panel.enabled=true` — required, panel ignores unlabeled containers
- `game-admin-panel.game=<game>` — identifies game type for game-specific logic

**Docker Compose auto-labels (read from `container.inspect()`):**
- `com.docker.compose.project.working_dir` — host path of the compose project directory. Used to locate `.env` files for CS2/Minecraft config reads/writes.

### Method 2: Host Filesystem Mount (`GAME_CONFIG_ROOT`)

The panel mounts the host's game directory as `/host-games`. Config services read/write files here.

```
docker-compose.yml:  ${GAME_CONFIG_ROOT}:/host-games
env var default:     /home/tyler/Docker/games
in-container path:   /host-games
```

**Games using filesystem mount for config:**

| Game | Config path pattern | Container volume type |
|---|---|---|
| **Icarus** | `/host-games/<name>/Saved/Config/WindowsServer/ServerSettings.ini` | Bind mount (`./data:/home/icarus/drive_c/icarus`) |
| **Icarus** | `/host-games/<name>/Saved/PlayerData/DedicatedServer/Prospects/` | Bind mount (same) |
| **CS2** | `/host-games/<name>/..compose-project../.env` via `com.docker.compose.project.working_dir` label | Named volume (`cs2:/home/steam/cs2-dedicated/`) — .env on host, game data in volume |
| **Minecraft** | `/host-games/<name>/..compose-project../.env` via compose label | Named volume (`minecraft-data:/data`) — .env on host, game data in volume |

**Games NOT using filesystem mount (configs inside named volumes):**

| Game | Config location (inside container) | Container volume type |
|---|---|---|
| **Factorio** | `/factorio/config/server-settings.json`, `/factorio/config/rconpw` | Named volume (`factorio-data:/factorio`) |
| **Terraria** | `/tshock/config.json` | Named volume (`terraria-data:/root/.local/share/Terraria/Worlds`) — TShock config may be at a different path |

**CRITICAL:** Factorio and Terraria config files live inside named Docker volumes, NOT on the host filesystem. The current config services (`factorioConfig.js`, `terrariaConfig.js`) incorrectly try to read from `/host-games/<container_name>/...` which won't work. These need to use the Docker archive API (`container.getArchive()`/`container.putArchive()`) or `container.exec()` to access files inside running containers.

**Volume mount note:** The `/host-games` mount is currently `:ro` (read-only). This MUST be changed to read-write for config saves to work on CS2/Minecraft.

### Method 3: Network Protocols (RCON / REST)

The panel connects to game servers over the `game-network` Docker network.

**RCON (Valve RCON protocol via `srcds-rcon` library):**

| Game | Default port | Password source | Notes |
|---|---|---|---|
| **Icarus** | 25575 | `ICARUS_RCON_PASSWORD` env var or `dateniteroolz` | Host-mode networking, falls back to `SERVER_PORT` env var |
| **CS2** | 27015 (game port) | `CS2_RCONPW` env var | RCON shares the game port |
| **Minecraft** | 25575 | `RCON_PASSWORD` env var | Standard RCON |
| **Factorio** | 27015 | `/factorio/config/rconpw` file | Read from volume |

**REST API (Terraria only, via HTTP):**

| Game | Default port | Auth | Endpoint pattern |
|---|---|---|---|
| **Terraria** | 7878 | Token from `ApplicationRestTokens` in TShock config | `GET /v3/server/rawcmd?token=X&cmd=Y` |

**Network resolution order:** The RCON/REST resolvers try these in order:
1. Container's IP on `game-network` (preferred — direct container-to-container)
2. `127.0.0.1` with host port mapping (fallback — for host-mode containers or when on same network host)

### Method 4: Docker Archive API (planned)

For accessing files inside named volumes (Factorio, Terraria configs, game data files).

| Docker API method | Purpose | Status |
|---|---|---|
| `container.getArchive({path})` | Read files from inside running containers | Planned — needed for Factorio/Terraria config + game data |
| `container.putArchive(path, stream)` | Write files into running containers | Planned — needed for Factorio/Terraria config saves |
| `container.exec()` | Run commands inside containers (e.g., `ls`, `cat`) | Planned — for directory listings in named volumes |

**Limitation:** Archive/exec APIs only work when the container is running. The panel should show a clear message when trying to access configs for stopped containers.

## Per-Game Technical Reference

### Icarus (`mornedhels/icarus-server`)
- **Config:** INI file (`ServerSettings.ini`), parsed by `icarusConfig.js`
- **Config location:** Bind-mounted, accessible at `GAME_CONFIG_ROOT/<name>/Saved/Config/...`
- **RCON:** Port 25575, password from env var, host-mode networking
- **Special:** Prospect file upload/download, launch parameters
- **Compose:** `~/Docker/games/icarus-server/` with `./data` bind mount

### CS2 (`joedwards32/cs2`)
- **Config:** `.env` file (env vars), parsed by `cs2Config.js`
- **Config location:** `.env` in compose project directory on host. Read via `com.docker.compose.project.working_dir` label
- **RCON:** Port 27015 (game port), password from `CS2_RCONPW` env var
- **Compose:** `~/Docker/games/cs2-server/`, named volume `cs2` for game data
- **TTY:** `stdin_open: true` + `tty: true` — logs may be non-framed (plain text)
- **Env fields:** 26 known fields in `CS2_ENV_FILEDS`. **IMPORTANT:** Write must preserve ALL existing env keys, not just known ones (e.g., `DEBUG`, `CS2_ADDITIONAL_ARGS`, `CS2_CFG_URL`)

### Minecraft (`itzg/minecraft-server`)
- **Config:** `.env` file (env vars), parsed by `minecraftConfig.js`
- **Config location:** `.env` in compose project directory on host. Read via compose label
- **RCON:** Port 25575, password from `RCON_PASSWORD` env var
- **Game data:** `whitelist.json`, `ops.json`, `banned-players.json`, `server.properties` — all inside named volume `/data/`
- **Compose:** `~/Docker/games/minecraft-server/`, named volume `minecraft-data` for `/data`
- **TTY:** `stdin_open: true` + `tty: true` — logs may be non-framed

### Factorio (`factoriotools/factorio:stable`)
- **Config:** JSON (`server-settings.json`), parsed by `factorioConfig.js`
- **Config location:** INSIDE named volume at `/factorio/config/`. NOT accessible from host filesystem
- **RCON:** Port 27015, password from `/factorio/config/rconpw` file
- **Game data:** `/factorio/saves/`, `/factorio/mods/`, `/factorio/config/server-adminlist.json`, `/factorio/config/server-banlist.json` — all inside volume
- **Compose:** `~/Docker/games/factorio-server/`, named volume `factorio-data` for `/factorio`
- **Config service bug:** `factorioConfig.js` reads from `/host-games/<name>/config/` which doesn't exist. Needs Docker archive API.

### Terraria (`ryshe/terraria`)
- **Config:** JSON (TShock `config.json`), parsed by `terrariaConfig.js`
- **Config location:** INSIDE container. TShock auto-generates config. Path may vary: `/tshock/config.json` or `/root/.local/share/Terraria/tshock/config.json`
- **REST:** Port 7878, token from `ApplicationRestTokens` in config. NOT RCON.
- **Game data:** World files inside container volume
- **Compose:** `~/Docker/games/terraria-server/`, named volume `terraria-data`
- **Config service bug:** `terrariaConfig.js` reads from `/host-games/<name>/tshock/config.json` which doesn't exist. Needs Docker archive API.

## AI Log Analysis

- **Provider:** OpenRouter (or any OpenAI-compatible API)
- **Env vars:** `OPENROUTER_API_KEY` (required to enable), `AI_MODEL` (default `openai/gpt-4.1-mini`), `AI_BASE_URL` (default `https://openrouter.ai/api/v1`)
- **Endpoint:** `POST /api/ai/:id/analyze-logs` — fetches container logs, sends to AI, returns analysis
- **Status:** `GET /api/ai/status` — returns `{ enabled: boolean }`
- **Frontend:** "Analyze with AI" button in logs panel, only visible when API key configured

## Key Files

| File | Purpose |
|---|---|
| `src/index.js` | Express app setup, route mounting, auth middleware |
| `src/services/docker.js` | Shared Dockerode instance |
| `src/services/rcon.js` | RCON client (Valve protocol via srcds-rcon) |
| `src/services/icarusConfig.js` | INI parser for Icarus |
| `src/services/cs2Config.js` | .env reader/writer for CS2 |
| `src/services/minecraftConfig.js` | .env reader/writer for Minecraft |
| `src/services/factorioConfig.js` | JSON config for Factorio (BROKEN — needs Docker archive API) |
| `src/services/terrariaConfig.js` | JSON config for Terraria (BROKEN — needs Docker archive API) |
| `src/services/backup.js` | Config auto-backup before saves |
| `src/routes/rcon.js` | RCON relay with game-specific resolvers |
| `src/routes/rest.js` | Terraria REST API proxy |
| `src/routes/logs.js` | Docker log streaming with framed-stream demuxer |
| `src/routes/ai.js` | AI log analysis via OpenRouter |
| `src/routes/events.js` | Docker event SSE stream |
| `src/routes/gameData.js` | Game-specific data (whitelist, saves, etc.) |
| `public/app.js` | Frontend — card rendering, config forms, RCON/REST panels, logs, game data, AI analysis |
| `public/utils.js` | Shared utility functions (dual browser/Node export) |

**Every push that changes code MUST bump `VERSION`.** This file is a single semver line (e.g. `1.2.0`) in the repo root. The panel displays it in the header via `/api/version`.

- **Patch bump (1.2.0 → 1.2.1)**: Bug fixes, UI polish, copy changes, dependency updates
- **Minor bump (1.2.0 → 1.3.0)**: New features, new endpoints, new frontend capabilities
- **Major bump (1.2.0 → 2.0.0)**: Breaking API changes, architecture reworks

Bump BEFORE committing — include the version change in the same commit as the work.

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

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
