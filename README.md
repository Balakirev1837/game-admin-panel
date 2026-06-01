# Game Admin Panel

A web dashboard for managing game servers running in Docker containers. Monitors containers, edits server configs, streams logs, sends console commands, and provides AI-powered log analysis — all from a browser.

## Supported Games

| Game | Image | Config Format | Console | Notes |
|------|-------|---------------|---------|-------|
| Icarus | `mornedhels/icarus-server` | INI (`ServerSettings.ini`) | RCON (port 25575) | Prospect upload/download, host-mode networking |
| CS2 | `joedwards32/cs2` | `.env` file | RCON (port 27015) | TTY container, env-based config |
| Minecraft | `itzg/minecraft-server` | `.env` file | RCON (port 25575) | TTY container, env-based config |
| Factorio | `factoriotools/factorio:stable` | JSON (`server-settings.json`) | RCON (port 27015) | Config inside named volume |
| Terraria | `ryshe/terraria` | JSON (TShock `config.json`) | REST API (port 7878) | Uses HTTP REST, not RCON |

## Quick Start

```bash
# Clone and enter the repo
git clone <repo-url> game-admin-panel
cd game-admin-panel

# Create the shared Docker network (one-time)
bash scripts/create-network.sh

# Install dependencies on the host (avoids Docker bridge DNS issues on Ubuntu)
npm install --omit=dev

# Build the image (no network needed — node_modules is baked in)
docker compose build admin-panel

# Start the panel
docker compose up -d
```

The panel is available at `http://<host>:3000`.

> **Why `npm install` on the host?** Docker's bridge network on Ubuntu can experience intermittent DNS timeouts under `systemd-resolved`. Running `npm install` on the host (which has reliable DNS) and copying `node_modules` into the image eliminates build-time network failures entirely.

## Architecture

- **Backend**: Node.js + Express, connects to the Docker daemon via mounted socket (`/var/run/docker.sock`)
- **Frontend**: Static HTML/JS served by Express, styled with Tailwind CSS
- **Network**: Uses a shared `game-network` (external Docker network) for container-to-container communication
- **Discovery**: Only shows containers labeled `game-admin-panel.enabled=true`
- **Game detection**: Uses `game-admin-panel.game=<game>` label for game-specific behavior

### Container Communication

The panel communicates with game containers through four methods:

1. **Docker Daemon API** (Dockerode) — container lifecycle, logs, stats, inspect data
2. **Host Filesystem** (`GAME_CONFIG_ROOT` mounted at `/host-games`) — config file read/write for bind-mounted volumes
3. **Network Protocols** (RCON/REST over `game-network`) — console commands, player lists
4. **Docker Archive API** (`container.getArchive`/`putArchive`/`exec`) — access files inside named volumes (Factorio, Terraria)

### Config File Access by Game

| Game | Config source | Access method |
|------|--------------|---------------|
| Icarus | Bind-mounted INI on host | Direct filesystem read/write |
| CS2 | `.env` in compose project dir | Filesystem via `com.docker.compose.project.working_dir` label |
| Minecraft | `.env` in compose project dir | Filesystem via compose label |
| Factorio | Inside named Docker volume (`/factorio/config/`) | Docker archive API (requires running container) |
| Terraria | Inside container (TShock config) | Docker archive API (requires running container) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/version` | Panel version |
| POST | `/api/auth/login` | Login with password |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/session` | Check session status |
| GET | `/api/containers` | List game containers with inspect data |
| POST | `/api/containers/:id/start` | Start a container |
| POST | `/api/containers/:id/stop` | Stop a container |
| POST | `/api/containers/:id/restart` | Restart a container |
| GET | `/api/containers/:id/config` | Read server config |
| PUT | `/api/containers/:id/config` | Write server config (with auto-backup) |
| GET | `/api/containers/:id/config/backups` | List config backups |
| POST | `/api/containers/:id/config/restore` | Restore a config backup |
| POST | `/api/containers/:id/rcon` | Send an RCON command |
| POST | `/api/containers/:id/rest` | Send a REST command (Terraria) |
| GET | `/api/containers/:id/logs` | Stream container logs |
| GET | `/api/containers/:id/resources` | Container resource stats |
| GET | `/api/containers/:id/players` | Player list |
| GET | `/api/containers/:id/image` | Container image info |
| GET | `/api/containers/:id/prospects` | List Icarus prospect saves |
| POST | `/api/containers/:id/prospects` | Upload an Icarus prospect save |
| GET | `/api/containers/:id/game-data/:type` | Game-specific data (whitelist, saves, etc.) |
| GET | `/api/host/stats` | Host system stats |
| GET | `/api/events/stream` | Docker event SSE stream |
| GET | `/api/events` | Recent Docker events |
| GET | `/api/ai/status` | AI analysis feature status |
| POST | `/api/ai/:id/analyze-logs` | AI-powered log analysis |
| POST | `/api/ai/:id/suggest-config` | AI config suggestions from natural language |
| POST | `/api/ai/:id/explain-error` | AI error explanation (cached by signature) |
| GET | `/api/schedules` | List scheduled actions |
| POST | `/api/schedules` | Create a scheduled action |
| PATCH | `/api/schedules/:id` | Update a schedule |
| DELETE | `/api/schedules/:id` | Delete a schedule |
| GET | `/api/containers/:id/snapshots` | List snapshots (Minecraft/Factorio) |
| POST | `/api/containers/:id/snapshots` | Create a snapshot |
| DELETE | `/api/containers/:id/snapshots/:name` | Delete a snapshot |
| POST | `/api/containers/:id/snapshots/:name/restore` | Restore a snapshot |
| GET | `/api/games` | Game metadata (adapters, config fields) |

## Adding a New Game Server

The panel auto-discovers game containers via Docker labels. To add a new game:

### 1. Create a `docker-compose.yml`

Your compose file must include:
- Label `game-admin-panel.enabled=true`
- Label `game-admin-panel.game=<game>` (e.g., `cs2`, `minecraft`)
- Join the shared `game-network`

```yaml
# Example: ~/Docker/games/mygame/docker-compose.yml
services:
  mygame:
    image: some-game-server-image:latest
    container_name: mygame
    restart: unless-stopped
    labels:
      - "game-admin-panel.enabled=true"
      - "game-admin-panel.game=mygame"
    ports:
      - "2456:2456/udp"
    volumes:
      - ./data:/server/data
    networks:
      default:
        name: game-network
        external: true
```

### 2. Start the server

```bash
docker compose up -d
```

The new server appears automatically in the panel.

### 3. Add config support (optional)

For the panel to edit configs, the game needs a config service in `src/services/`. See existing services (`icarusConfig.js`, `cs2Config.js`, etc.) for patterns.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Host port for the panel |
| `GAME_CONFIG_ROOT` | `/home/tyler/Docker/games` | Host path to game server directories (mounted at `/host-games`) |
| `GAME_CONFIG_ROOT_HOST` | `/home/tyler/Docker/games` | Host path used for compose working dir resolution |
| `ADMIN_PASSWORD` | *(unset)* | Set to enable authentication. Unset = open panel |
| `ADMIN_USERNAME` | `admin` | Username for login |
| `ICARUS_RCON_PASSWORD` | `dateniteroolz` | Default RCON password for Icarus |
| `NTFY_TOPIC` | *(unset)* | ntfy.sh topic for container die/OOM notifications and daily digest |
| `LOG_LEVEL` | `info` | Pino log level |
| `BACKUP_RETENTION` | `10` | Number of config backups to keep per container |
| `OPENROUTER_API_KEY` | *(unset)* | Set to enable AI log analysis via OpenRouter |
| `AI_MODEL` | `openai/gpt-4.1-mini` | AI model for log analysis |
| `AI_BASE_URL` | `https://openrouter.ai/api/v1` | AI API base URL (any OpenAI-compatible endpoint) |

## Development

```bash
npm install
npm test          # 397 tests, 29 suites
npm start         # Run without Docker (needs local Docker socket)
```

---

This is firmly [houseplant software](https://hannahilea.com/blog/houseplant-programming/)! It probably won't do what you want!
