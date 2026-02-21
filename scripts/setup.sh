#!/usr/bin/env bash
set -euo pipefail

echo "== ValerPay setup =="
echo "1) Backend deps"
cd "$(dirname "$0")/../src/backend"
npm install

echo "2) Frontend admin deps"
cd "../frontend/admin"
npm install

echo "3) Frontend user deps"
cd "../user"
npm install

echo "Done. Copy env templates next:"
echo "  cp ../../.env.example ../backend/.env"
echo "  cp ../../.env.example ./.env.local  (in admin and user)"
