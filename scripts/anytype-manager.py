#!/usr/bin/env python3
"""
AnyType File Manager - Full read/write/delete access via MongoDB
"""

import json
import subprocess
from pathlib import Path
from pymongo import MongoClient
from bson.binary import Binary
import hashlib
import os
from datetime import datetime

class AnytypeManager:
    def __init__(self):
        self.mongo_client = MongoClient('mongodb://localhost:27017/')
        self.coordinator_db = self.mongo_client['coordinator']
        self.spaces_col = self.coordinator_db['spaces']
        self.inbox_col = self.coordinator_db['inboxMessages']
        self.identity_col = self.coordinator_db['identityRepo']
        
        # AnyType storage paths
        self.storage_root = Path('/var/lib/anytype/data/storage')
        self.sync_storage = self.storage_root / 'storage-sync'
        self.file_storage = self.storage_root / 'storage-file'
    
    def list_spaces(self, identity_filter=None):
        """List all spaces, optionally filtered by identity"""
        query = {}
        if identity_filter:
            query['identity'] = identity_filter
        spaces = list(self.spaces_col.find(query))
        return spaces
    
    def get_space_info(self, space_id):
        """Get detailed space information"""
        return self.spaces_col.find_one({'_id': space_id})
    
    def grant_full_access(self, space_id):
        """Grant full read/write/delete access to a space"""
        space = self.get_space_info(space_id)
        if not space:
            return False
        
        result = self.spaces_col.update_one(
            {'_id': space_id},
            {
                '$set': {
                    'botAccess': True,
                    'botCanRead': True,
                    'botCanWrite': True,
                    'botCanDelete': True,
                    'botAccessGrantedAt': datetime.utcnow().isoformat()
                }
            }
        )
        return result.modified_count > 0
    
    def get_space_storage_path(self, space_id):
        """Get the storage directory for a space"""
        return self.sync_storage / space_id
    
    def list_files_in_space(self, space_id):
        """List all files in a space's storage"""
        storage_path = self.get_space_storage_path(space_id)
        if not storage_path.exists():
            return []
        
        files = []
        for item in storage_path.rglob('*'):
            if item.is_file() and not item.name.startswith('.'):
                files.append({
                    'path': str(item),
                    'name': item.name,
                    'size': item.stat().st_size,
                    'modified': datetime.fromtimestamp(item.stat().st_mtime).isoformat()
                })
        return files
    
    def export_file(self, space_id, file_name, output_path):
        """Export a file from space storage"""
        storage_path = self.get_space_storage_path(space_id)
        file_path = storage_path / file_name
        
        if not file_path.exists():
            return False
        
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, 'rb') as src:
            with open(output, 'wb') as dst:
                dst.write(src.read())
        
        return True
    
    def upload_file(self, space_id, file_path, target_name=None):
        """Upload a file to a space"""
        file_path = Path(file_path)
        if not file_path.exists():
            return False
        
        storage_path = self.get_space_storage_path(space_id)
        storage_path.mkdir(parents=True, exist_ok=True)
        
        target = target_name or file_path.name
        target_path = storage_path / target
        
        with open(file_path, 'rb') as src:
            with open(target_path, 'wb') as dst:
                dst.write(src.read())
        
        return True
    
    def delete_file(self, space_id, file_name):
        """Delete a file from a space"""
        storage_path = self.get_space_storage_path(space_id)
        file_path = storage_path / file_name
        
        if file_path.exists():
            file_path.unlink()
            return True
        return False
    
    def move_file(self, space_id, source_name, dest_name):
        """Move/rename a file within a space"""
        storage_path = self.get_space_storage_path(space_id)
        source = storage_path / source_name
        dest = storage_path / dest_name
        
        if source.exists():
            source.rename(dest)
            return True
        return False
    
    def search_files(self, space_id, pattern):
        """Search for files matching a pattern"""
        files = self.list_files_in_space(space_id)
        return [f for f in files if pattern.lower() in f['name'].lower()]

def print_spaces_summary():
    """Print summary of all spaces"""
    mgr = AnytypeManager()
    spaces = mgr.list_spaces()
    
    print("\n" + "="*80)
    print("AnyType Spaces Summary")
    print("="*80)
    
    # Group by identity
    by_identity = {}
    for space in spaces:
        identity = space['identity']
        if identity not in by_identity:
            by_identity[identity] = []
        by_identity[identity].append(space)
    
    for identity, space_list in by_identity.items():
        print(f"\nIdentity: {identity}")
        print(f"  Spaces: {len(space_list)}")
        for space in space_list[:5]:  # Show first 5
            status_map = {0: 'Active', 3: 'Deleted'}
            type_map = {1: 'Profile', 2: 'Workspace', 4: 'Workspace'}
            print(f"    - {space['_id']}")
            print(f"      Type: {type_map.get(space['type'], 'Unknown')}")
            print(f"      Status: {status_map.get(space['status'], 'Unknown')}")
            print(f"      Shareable: {space['isShareable']}")

if __name__ == '__main__':
    import sys
    
    mgr = AnytypeManager()
    
    if len(sys.argv) < 2:
        print_spaces_summary()
    elif sys.argv[1] == 'list':
        spaces = mgr.list_spaces()
        for space in spaces:
            print(f"{space['_id'][:40]}... - {space['identity'][:20]}...")
    elif sys.argv[1] == 'files' and len(sys.argv) > 2:
        space_id = sys.argv[2]
        files = mgr.list_files_in_space(space_id)
        print(f"\nFiles in {space_id}:")
        for f in files:
            print(f"  - {f['name']} ({f['size']} bytes)")
    elif sys.argv[1] == 'grant' and len(sys.argv) > 2:
        space_id = sys.argv[2]
        if mgr.grant_full_access(space_id):
            print(f"✓ Full access granted to {space_id}")
        else:
            print(f"✗ Failed to grant access")
