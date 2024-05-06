#!/bin/bash
set -e

echo "Starting NodeJS app"
pm2 start --restart-delay 3000 /app/index.js
echo "NodeJS app started, continuing to start drachtio"

echo "Starting Drachtio"

exec drachtio --contact "sip:*:${DRACHTIO_SIPPORT};transport=udp,tcp" --external-ip $DRACHTIO_PUBLICIP
