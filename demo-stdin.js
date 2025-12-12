#!/usr/bin/env node

console.log('╔════════════════════════════════════════════════╗');
console.log('║     STDIN DEMONSTRATION SCRIPT                 ║');
console.log('╚════════════════════════════════════════════════╝\n');

console.log('This script is now listening for data on STDIN...\n');

let inputData = '';
let chunkCount = 0;

// Listen for data coming in
process.stdin.on('data', (chunk) => {
  chunkCount++;
  console.log(`📥 Chunk #${chunkCount} received (${chunk.length} bytes)`);
  console.log('   Content:', chunk.toString().substring(0, 50) + '...\n');
  inputData += chunk;
});

// When all data is received
process.stdin.on('end', () => {
  console.log('✅ STDIN closed - all data received!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 SUMMARY:');
  console.log(`   Total chunks: ${chunkCount}`);
  console.log(`   Total bytes: ${inputData.length}`);
  console.log(`   Total lines: ${inputData.split('\n').length}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📝 FULL DATA RECEIVED:\n');
  console.log(inputData);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Try to parse as JSON
  console.log('🔍 Attempting to parse as JSON...\n');
  try {
    const parsed = JSON.parse(inputData);
    console.log('✅ Valid JSON! Here\'s the parsed object:\n');
    console.log(JSON.stringify(parsed, null, 2));
    console.log('\n🎯 You could now extract fields like:');
    console.log(`   - parsed.conversation_id = ${parsed.conversation_id || 'not found'}`);
    console.log(`   - parsed.session_id = ${parsed.session_id || 'not found'}`);
    console.log(`   - parsed.prompt = ${parsed.prompt || 'not found'}`);
  } catch (error) {
    console.log('❌ Not valid JSON - that\'s okay! It\'s just plain text.');
    console.log(`   Error: ${error.message}\n`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💡 This is EXACTLY what prompt-logger.js and');
  console.log('   edit-logger.js do when Cursor/Claude call them!\n');
});

// If no data comes in after 3 seconds, give instructions
setTimeout(() => {
  if (inputData === '') {
    console.log('⏰ No data received yet. Here\'s how to test:\n');
    console.log('1. In another terminal, run:');
    console.log('   echo "Hello World" | node demo-stdin.js\n');
    console.log('2. Or pipe JSON:');
    console.log('   echo \'{"name":"John","age":30}\' | node demo-stdin.js\n');
    console.log('3. Or pipe a file:');
    console.log('   cat package.json | node demo-stdin.js\n');
    console.log('Waiting for data... (Press Ctrl+C to exit)\n');
  }
}, 3000);
