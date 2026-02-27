#!/bin/bash
# Fix dependencies and regenerate go.sum

set -e

echo "Fixing Go dependencies..."

# Clean existing cache
echo "1. Cleaning Go cache..."
go clean -modcache

# Remove go.sum to force regeneration
echo "2. Removing go.sum..."
rm -f go.sum

# Download dependencies fresh
echo "3. Downloading dependencies..."
go mod download

# Tidy up and regenerate go.sum
echo "4. Running go mod tidy..."
go mod tidy

# Verify the imports
echo "5. Verifying imports..."
go list -m all | grep anytype-heart

echo ""
echo "✅ Dependencies fixed!"
echo "Now run: make build"
