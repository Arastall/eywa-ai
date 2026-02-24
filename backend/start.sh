#!/bin/bash
cd /home/iainh/eywa-ai/backend
export PATH="/home/iainh/.nvm/versions/node/v22.22.0/bin:$PATH"
exec npx tsx src/index.ts
