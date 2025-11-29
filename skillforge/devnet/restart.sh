#!/bin/bash

# Restart SkillForge devnet
set -e

echo "🔄 Restarting SkillForge devnet..."

cd "$(dirname "$0")"

# Stop all containers
echo "⏹️  Stopping containers..."
docker-compose down

# Clean data (optional - comment out to preserve state)
# echo "🧹 Cleaning data..."
# rm -rf data/node-*/db/*

# Start containers
echo "▶️  Starting containers..."
docker-compose up -d

echo "⏳ Waiting for nodes to start..."
sleep 5

# Check node status
echo "🔍 Checking node status..."
docker-compose ps

echo ""
echo "✅ Devnet restarted"
echo "💡 Check logs: docker-compose logs -f cardano-node-1"
echo "💡 Query tip: docker exec skillforge-node-1 cardano-cli query tip --testnet-magic 42 --socket-path /data/node.socket"



