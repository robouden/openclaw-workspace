package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

const objectMapFile = "/root/.anytype-workspace-objectmap.json"

// ObjectMap tracks the mapping between filenames and AnyType object IDs
type ObjectMap struct {
	mu      sync.RWMutex
	mapping map[string]string // filename -> objectID
}

// NewObjectMap creates a new object map and loads existing mappings
func NewObjectMap() (*ObjectMap, error) {
	om := &ObjectMap{
		mapping: make(map[string]string),
	}

	// Try to load existing mappings
	if err := om.load(); err != nil {
		// If file doesn't exist, that's ok
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("failed to load object map: %w", err)
		}
	}

	return om, nil
}

// Set stores a filename -> objectID mapping
func (om *ObjectMap) Set(filename, objectID string) error {
	om.mu.Lock()
	defer om.mu.Unlock()

	om.mapping[filename] = objectID
	return om.save()
}

// Get retrieves the objectID for a filename
func (om *ObjectMap) Get(filename string) (string, bool) {
	om.mu.RLock()
	defer om.mu.RUnlock()

	objectID, exists := om.mapping[filename]
	return objectID, exists
}

// Delete removes a filename mapping
func (om *ObjectMap) Delete(filename string) error {
	om.mu.Lock()
	defer om.mu.Unlock()

	delete(om.mapping, filename)
	return om.save()
}

// load reads the object map from disk
func (om *ObjectMap) load() error {
	data, err := os.ReadFile(objectMapFile)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, &om.mapping)
}

// save writes the object map to disk
func (om *ObjectMap) save() error {
	data, err := json.MarshalIndent(om.mapping, "", "  ")
	if err != nil {
		return err
	}

	// Ensure directory exists
	dir := filepath.Dir(objectMapFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(objectMapFile, data, 0644)
}
