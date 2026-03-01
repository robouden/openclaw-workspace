#!/bin/bash
# Monitor for Screenshot_20260301-074812 from AnyType

MAIN_SPACE="bafyreig4q7t3vt7b7zmvfv3emj7jfrvjamuhu4crws3dhn3uaxhh3u37k4.10piockh34xft"
STORAGE_PATH="/var/lib/anytype/data/storage/storage-sync/$MAIN_SPACE"

# Search for the screenshot in AnyType storage
FOUND=$(python3 << 'EOF'
import sys
from pathlib import Path
from pymongo import MongoClient

mongo_client = MongoClient('mongodb://localhost:27017/')
coordinator_db = mongo_client['coordinator']
spaces_col = coordinator_db['spaces']

main_space = 'bafyreig4q7t3vt7b7zmvfv3emj7jfrvjamuhu4crws3dhn3uaxhh3u37k4.10piockh34xft'
storage_path = Path('/var/lib/anytype/data/storage/storage-sync') / main_space

if not storage_path.exists():
    sys.exit(0)

# Search for screenshot file
for item in storage_path.rglob('*'):
    if item.is_file() and 'Screenshot_20260301-074812' in item.name:
        print(f"FOUND:{item.name}:{item.stat().st_size}")
        sys.exit(0)

sys.exit(1)
EOF
)

if [ $? -eq 0 ] && [ -n "$FOUND" ]; then
    echo "$FOUND"
    exit 0
else
    exit 1
fi
