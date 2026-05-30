#!/bin/bash
# Create shared game-network if it doesn't exist
docker network create game-network 2>/dev/null || true