.PHONY: build clean deps test install

# Binary name
BINARY=anytype-workspace-sync-bin
OUTPUT_DIR=/root

# Build the binary
build: deps
	@echo "Building $(BINARY)..."
	go build -o $(BINARY) .
	@echo "Build complete: $(BINARY)"

# Install dependencies and tidy go.mod
deps:
	@echo "Installing dependencies..."
	go mod download
	go mod tidy
	@echo "Dependencies installed"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -f $(BINARY)
	@echo "Clean complete"

# Install binary to /root
install: build
	@echo "Installing $(BINARY) to $(OUTPUT_DIR)..."
	cp $(BINARY) $(OUTPUT_DIR)/$(BINARY)
	@echo "Installed to $(OUTPUT_DIR)/$(BINARY)"
	@echo "Restart service with: systemctl restart anytype-workspace-sync.service"

# Run tests
test:
	@echo "Running tests..."
	go test -v ./...

# Quick rebuild and install
quick: clean install

# Show help
help:
	@echo "Available targets:"
	@echo "  build   - Build the binary"
	@echo "  deps    - Install dependencies"
	@echo "  clean   - Remove build artifacts"
	@echo "  install - Build and install to $(OUTPUT_DIR)"
	@echo "  quick   - Clean, build, and install"
	@echo "  test    - Run tests"
	@echo "  help    - Show this help message"
