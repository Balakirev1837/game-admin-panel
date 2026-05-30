# Game Admin Panel

A lightweight web dashboard for managing game servers running in Docker containers. Lists servers, starts/stops containers, edits INI configs, and sends RCON commands. This is firmly [houseplant software](https://hannahilea.com/blog/houseplant-programming/)! It probably won't do what you want!

## Quick Start

```bash
# Clone and enter the repo
git clone <repo-url> game-admin-panel
cd game-admin-panel

# Create the shared Docker network (one-time)
bash scripts/create-network.sh

# Build and start
docker compose up --build -d
```

The panel is now available at `http://<host>:3000`.

## Architecture

- **Backend**: Node.js + Express, connects to the Docker daemon via mounted socket
- **Frontend**: Static HTML/JS served by Express, styled with Tailwind CSS
- **Network**: Uses a shared `game-network` (external) so the panel can reach game servers by container name
- **Discovery**: Only shows containers labeled `game-admin-panel.enabled=true`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/containers` | List game containers |
| POST | `/api/containers/:id/start` | Start a container |
| POST | `/api/containers/:id/stop` | Stop a container |
| GET | `/api/containers/:id/config` | Read server config (INI) |
| PUT | `/api/containers/:id/config` | Write server config (INI) |
| POST | `/api/containers/:id/rcon` | Send an RCON command |

## Adding a New Game Server

The panel auto-discovers game containers via a Docker label. To add a new game:

### 1. Create a `docker-compose.yml` for your game

Name the directory after your game (e.g. `~/Docker/games/valheim/`). Your compose file must:

- Use `container_name` matching the directory name (the panel uses this to find config files)
- Include the label `game-admin-panel.enabled=true`
- Join the shared `game-network`

```yaml
# Example: ~/Docker/games/mygame/docker-compose.yml
version: '3.8'

services:
  mygame:
    image: some-game-server-image:latest
    container_name: mygame
    restart: unless-stopped
    labels:
      - "game-admin-panel.enabled=true"
    ports:
      - "2456:2456/udp"
      - "2457:2457/udp"
    volumes:
      - ./data:/server/data
    environment:
      - SERVER_NAME=My Game
      - SERVER_PORT=2456

networks:
  default:
    name: game-network
    external: true
```

### 2. Place config files in the expected location

The panel reads configs from:

```
<GAME_CONFIG_ROOT>/<container_name>/Saved/Config/WindowsServer/ServerSettings.ini
```

For non-Icarus games, you can override `GAME_CONFIG_ROOT` in `.env` to point to wherever your game stores its config files.

### 3. Start the server

```bash
docker compose up -d
```

The new server appears automatically in the panel — no restart needed.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Host port for the panel |
| `ICARUS_RCON_PASSWORD` | `dateniteroolz` | Default RCON password |
| `GAME_CONFIG_ROOT` | `/home/tyler/Docker/games` | Host path to game server directories |

## Development

```bash
npm install
npm test          # 68 tests, 7 suites
npm start         # Run without Docker (needs local Docker socket)
```
