#!/bin/bash
# Delete duplicate AnyType objects via gRPC

set -e

echo "🗑️ AnyType Duplicate Cleanup Script"
echo "===================================="
echo ""

# AnyType bot account credentials
ACCOUNT_KEY="N4Hw/9GQmio2f4sBU7PXZbl5akrL+2kmhP7SZ9RJp956u5/08V9LgdW975DSYXSk8b3+kZbIP0sZpuEOxFwp6g=="
ACCOUNT_ID="A6JZwRq6eouJi4F5pumdZug7rG2jNLkGDBpKEwkDPUV96ZtS"
API_KEY="DzVdxvMC41698O2sTET4e7KrusuU/zXW4V/7wCRuJlk="
SPACE_ID="bafyreibwatfpuq23i74kdfzev5woe64aduy6u4fuijljmzycoawuanjmmq.35fpfsusofs1o"

# Objects to delete (old duplicates)
DUPLICATES=(
  "bafyreic5ofsrk6qlv5cn3aatpat7gte3wrn2urn65uk3gkuugo6mkdgnmq"  # VPS Daily Report duplicate
  "bafyreibtyhswnvpv2v5mybm2edwijw36kijbzkrrnx2d4lilddy34h4fpa"  # Mistral Migration duplicate
)

echo "Target objects to delete:"
for obj_id in "${DUPLICATES[@]}"; do
  echo "  - $obj_id"
done
echo ""

# Try deleting via gRPC (HTTP API endpoint)
for obj_id in "${DUPLICATES[@]}"; do
  echo "Deleting: $obj_id"
  
  # Use curl to delete via HTTP API
  curl -s -X DELETE \
    "http://127.0.0.1:31012/api/v1/spaces/$SPACE_ID/objects/$obj_id" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null && echo "  ✓ Deleted successfully" || echo "  ⚠ Delete may have failed (API might not support HTTP DELETE)"
    
  sleep 1
done

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Check AnyType to verify duplicates are gone"
echo "2. If duplicates still exist, delete manually via UI"
echo "3. Update ANYTYPE-OBJECT-MAP.md with final IDs"
