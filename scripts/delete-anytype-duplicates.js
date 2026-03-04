#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🗑️ AnyType Duplicate Cleanup Script');
console.log('====================================\n');

// Duplicate object IDs to delete
const duplicates = [
  {
    id: 'bafyreic5ofsrk6qlv5cn3aatpat7gte3wrn2urn65uk3gkuugo6mkdgnmq',
    title: 'VPS Daily Health Report — 2026-03-04 (duplicate)',
    keep: 'bafyreigwwp3rnndjur6qcbpmdm2yau2smmyd6i56o3a6vmyifer7h44egi'
  },
  {
    id: 'bafyreibtyhswnvpv2v5mybm2edwijw36kijbzkrrnx2d4lilddy34h4fpa',
    title: 'Mistral Migration & Cost Optimization — 2026-03-04 (duplicate)',
    keep: 'bafyreifulhlu2u5h66bhrcqsiqf53622ipduutokfoiovnmet2ixnrvrim'
  }
];

console.log('Objects to delete:');
duplicates.forEach((dup, i) => {
  console.log(`  ${i + 1}. ${dup.title}`);
  console.log(`     ID: ${dup.id}`);
  console.log(`     Keep: ${dup.keep}\n`);
});

// Try using AnyType CLI to delete
console.log('Attempting deletion via AnyType CLI...\n');

let successCount = 0;
let failCount = 0;

duplicates.forEach((dup) => {
  try {
    console.log(`Deleting: ${dup.title}`);
    
    // Try using anytype CLI if available
    try {
      execSync(`anytype object delete ${dup.id}`, { stdio: 'pipe' });
      console.log('  ✓ Deleted via CLI\n');
      successCount++;
    } catch (e) {
      // CLI might not support this, try gRPC wrapper
      console.log('  ⚠ CLI method failed, trying alternative...');
      
      // Could implement gRPC here if we have protobuf definitions
      console.log('  Note: Direct gRPC deletion requires protobuf setup\n');
      failCount++;
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
    failCount++;
  }
});

console.log('=================================');
console.log(`✅ Deleted: ${successCount}`);
console.log(`⚠️  Failed: ${failCount}`);
console.log('=================================\n');

if (failCount > 0) {
  console.log('⚠️  Some deletions failed.');
  console.log('\nManual cleanup required:');
  console.log('1. Open AnyType');
  console.log('2. Find duplicate objects:');
  duplicates.forEach((dup) => {
    console.log(`   - ${dup.title}`);
  });
  console.log('3. Delete the old versions (keep the more recent one)');
  console.log('\nObject IDs to delete manually:');
  duplicates.forEach((dup) => {
    console.log(`  ${dup.id}`);
  });
} else {
  console.log('✅ All duplicates cleaned up!\n');
  console.log('Next steps:');
  console.log('1. Verify in AnyType that duplicates are gone');
  console.log('2. Update ANYTYPE-OBJECT-MAP.md with confirmed IDs');
  console.log('3. Commit changes to GitHub');
}
