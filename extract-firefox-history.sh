#!/bin/bash
# extract-firefox-history.sh
# Extract Firefox browser history for a specific date
# Usage: ./extract-firefox-history.sh [YYYY-MM-DD]
# Default: yesterday

set -euo pipefail

# Get date (default to yesterday if not provided)
TARGET_DATE="${1:-$(date -d 'yesterday' +%Y-%m-%d)}"

echo "Extracting Firefox history for: $TARGET_DATE"

# Find Firefox profile directory
FIREFOX_DIR="$HOME/.mozilla/firefox"
if [ ! -d "$FIREFOX_DIR" ]; then
    echo "ERROR: Firefox directory not found at $FIREFOX_DIR"
    exit 1
fi

# Find the profile with the most recent places.sqlite
PLACES_DB=$(find "$FIREFOX_DIR" -name "places.sqlite" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$PLACES_DB" ] || [ ! -f "$PLACES_DB" ]; then
    echo "ERROR: No places.sqlite found in Firefox profiles"
    exit 1
fi

PROFILE_DIR=$(dirname "$PLACES_DB")
echo "Using profile: $PROFILE_DIR"

# Create temp copy to avoid locking issues
TEMP_DB="/tmp/places_$(date +%s).sqlite"
cp "$PLACES_DB" "$TEMP_DB"

# Calculate timestamps for the target date
START_TIMESTAMP=$(date -d "$TARGET_DATE 00:00:00" +%s)000000  # Firefox uses microseconds
END_TIMESTAMP=$(date -d "$TARGET_DATE 23:59:59" +%s)000000

echo "Timestamp range: $START_TIMESTAMP to $END_TIMESTAMP"

# Extract history for the date
sqlite3 "$TEMP_DB" <<EOF
SELECT 
    datetime(h.visit_date/1000000, 'unixepoch', 'localtime') as visit_time,
    p.url,
    p.title
FROM moz_historyvisits h
JOIN moz_places p ON h.place_id = p.id
WHERE h.visit_date >= $START_TIMESTAMP 
  AND h.visit_date <= $END_TIMESTAMP
ORDER BY h.visit_date ASC;
EOF

# Cleanup
rm -f "$TEMP_DB"

echo "Done!"
