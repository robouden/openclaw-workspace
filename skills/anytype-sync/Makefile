.PHONY: build build-linux build-mac clean test help install

help:
	@echo "AnyType Sync Skill - Build Commands"
	@echo ""
	@echo "  make build          Build anytype-db binary for current platform"
	@echo "  make build-linux    Build for Linux (x64)"
	@echo "  make build-mac      Build for macOS (Intel & ARM)"
	@echo "  make clean          Remove built binaries"
	@echo "  make test           Test the binary"
	@echo "  make install        Install to ~/.local/bin"
	@echo ""

build:
	@echo "Building anytype-db for current platform..."
	go mod tidy
	go build -o anytype-db ./cmd/anytype-db
	@echo "✓ Built: ./anytype-db"

build-linux:
	@echo "Building anytype-db for Linux..."
	GOOS=linux GOARCH=amd64 go build -o anytype-db-linux ./cmd/anytype-db
	@echo "✓ Built: ./anytype-db-linux"

build-mac:
	@echo "Building anytype-db for macOS..."
	GOOS=darwin GOARCH=amd64 go build -o anytype-db-mac-intel ./cmd/anytype-db
	GOOS=darwin GOARCH=arm64 go build -o anytype-db-mac-arm ./cmd/anytype-db
	@echo "✓ Built: ./anytype-db-mac-intel ./anytype-db-mac-arm"

clean:
	@echo "Cleaning built binaries..."
	rm -f anytype-db anytype-db-* 
	@echo "✓ Cleaned"

test: build
	@echo "Testing anytype-db..."
	@./anytype-db help > /dev/null && echo "✓ Help works" || echo "✗ Help failed"
	@echo "Test complete"

install: build
	@echo "Installing to ~/.local/bin..."
	mkdir -p ~/.local/bin
	cp anytype-db ~/.local/bin/
	chmod +x ~/.local/bin/anytype-db
	@echo "✓ Installed: ~/.local/bin/anytype-db"
	@echo ""
	@echo "Add to PATH:"
	@echo "  export PATH=$$HOME/.local/bin:$$PATH"
