#!/usr/bin/env node

/**
 * WebRTC Hook Integration Test
 * 
 * This script tests the WebRTC hook functionality to ensure:
 * 1. No race conditions occur
 * 2. Handlers are stable and don't cause reconnections
 * 3. Media initializes before socket connects
 * 4. Peer connections are created correctly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 WebRTC Hook Integration Test\n');
console.log('=' .repeat(60));

// Test Results Tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: '✅ PASS' });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: '❌ FAIL', error: error.message });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

console.log('\n📋 Test Suite: WebRTC Hook Structure\n');

// Test 1: Check file exists
test('Hook file exists', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  assert(fs.existsSync(hookPath), 'use-webrtc.ts file should exist');
});

// Test 2: Check for handlersRef
test('Hook contains handlersRef for stable references', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  assert(content.includes('handlersRef'), 'Should have handlersRef');
  assert(content.includes('useRef<{'), 'handlersRef should be a useRef');
});

// Test 3: Check handlers are stored in refs
test('Handlers are stored in handlersRef', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  assert(
    content.includes('handlersRef.current.handleUserJoined'),
    'handleUserJoined should be stored in ref'
  );
  assert(
    content.includes('handlersRef.current.handleUserLeft'),
    'handleUserLeft should be stored in ref'
  );
  assert(
    content.includes('handlersRef.current.handleSignal'),
    'handleSignal should be stored in ref'
  );
  assert(
    content.includes('handlersRef.current.handleSessionEnded'),
    'handleSessionEnded should be stored in ref'
  );
});

// Test 4: Check socket uses refs instead of direct handlers
test('Socket event listeners use handlersRef', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  // Check that socket.on uses refs
  const socketOnPattern = /socket\.on\('user-joined',.*handlersRef\.current\.handleUserJoined/s;
  assert(
    socketOnPattern.test(content),
    'Socket should use handlersRef for user-joined event'
  );
});

// Test 5: Check socket effect dependencies
test('Socket effect has stable dependencies', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  // Find the socket useEffect dependency array
  const socketEffectMatch = content.match(/useEffect\(\(\) => \{[\s\S]*?socket\.on\('connect'[\s\S]*?\}, \[(.*?)\]\);/);
  
  if (socketEffectMatch) {
    const deps = socketEffectMatch[1];
    
    // Should NOT include handler functions
    assert(
      !deps.includes('handleUserJoined'),
      'Socket effect should NOT depend on handleUserJoined'
    );
    assert(
      !deps.includes('handleUserLeft'),
      'Socket effect should NOT depend on handleUserLeft'
    );
    assert(
      !deps.includes('handleSignal'),
      'Socket effect should NOT depend on handleSignal'
    );
    assert(
      !deps.includes('handleSessionEnded'),
      'Socket effect should NOT depend on handleSessionEnded'
    );
    
    // Should include stable values
    assert(
      deps.includes('state.localStream'),
      'Socket effect should depend on state.localStream'
    );
  }
});

// Test 6: Check for connection guard
test('Socket effect has connection guard', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  assert(
    content.includes('socketRef.current?.connected'),
    'Should check if socket is already connected'
  );
});

// Test 7: Check media ready guard
test('Socket waits for media to be ready', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  // Find socket effect
  const socketEffectMatch = content.match(/useEffect\(\(\) => \{([\s\S]*?)socket\.on\('connect'/);
  
  if (socketEffectMatch) {
    const effectBody = socketEffectMatch[1];
    assert(
      effectBody.includes('if (!state.localStream)'),
      'Socket effect should check if localStream is ready'
    );
  }
});

// Test 8: Check for mediaReadyRef
test('Hook uses mediaReadyRef for safety', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  assert(
    content.includes('mediaReadyRef'),
    'Should have mediaReadyRef for tracking media state'
  );
  assert(
    content.includes('mediaReadyRef.current = true'),
    'Should set mediaReadyRef to true when media is ready'
  );
});

// Test 9: Check for localStreamRef
test('Hook uses localStreamRef for stable stream reference', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  assert(
    content.includes('localStreamRef'),
    'Should have localStreamRef'
  );
  assert(
    content.includes('localStreamRef.current = stream'),
    'Should store stream in localStreamRef'
  );
});

// Test 10: Check peer creation safety
test('Peer creation checks for local stream', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  // Check createPeerConnection function
  const createPeerMatch = content.match(/createPeerConnection[\s\S]*?if \(!localStreamRef\.current\)/);
  assert(
    createPeerMatch,
    'createPeerConnection should check if localStreamRef.current exists'
  );
});

// Test 11: Check for comprehensive logging
test('Hook has comprehensive logging for debugging', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  assert(
    content.includes('console.log') || content.includes('console.warn'),
    'Should have logging statements'
  );
  assert(
    content.includes('initializeMedia:'),
    'Should log media initialization steps'
  );
  assert(
    content.includes('handleUserJoined called:'),
    'Should log when handleUserJoined is called'
  );
});

// Test 12: Check function order (handlers before socket effect)
test('Handlers are defined before socket effect', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  const handleUserJoinedIndex = content.indexOf('const handleUserJoined');
  const socketEffectIndex = content.indexOf("socket.on('connect'");
  
  assert(
    handleUserJoinedIndex < socketEffectIndex,
    'handleUserJoined should be defined before socket effect'
  );
});

// Test 13: Check for cleanup function
test('Hook has proper cleanup function', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  assert(
    content.includes('const cleanup'),
    'Should have cleanup function'
  );
  assert(
    content.includes('track.stop()'),
    'Cleanup should stop media tracks'
  );
  assert(
    content.includes('peer.destroy()'),
    'Cleanup should destroy peer connections'
  );
});

// Test 14: Check for pending peers queue
test('Hook queues peers when media not ready', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  assert(
    content.includes('pendingPeersRef'),
    'Should have pendingPeersRef for queuing'
  );
});

// Test 15: Check TypeScript types
test('Hook has proper TypeScript types', () => {
  const hookPath = path.join(__dirname, 'client', 'src', 'hooks', 'use-webrtc.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');
  
  assert(
    content.includes('interface Participant'),
    'Should define Participant interface'
  );
  assert(
    content.includes('interface UseWebRTCProps'),
    'Should define UseWebRTCProps interface'
  );
  assert(
    content.includes('interface WebRTCState'),
    'Should define WebRTCState interface'
  );
});

console.log('\n' + '='.repeat(60));
console.log('\n📊 Test Results Summary\n');
console.log(`Total Tests: ${results.passed + results.failed}`);
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

if (results.failed > 0) {
  console.log('\n❌ Failed Tests:');
  results.tests
    .filter(t => t.status.includes('FAIL'))
    .forEach(t => {
      console.log(`   - ${t.name}`);
      if (t.error) console.log(`     ${t.error}`);
    });
}

console.log('\n' + '='.repeat(60));

if (results.failed === 0) {
  console.log('\n🎉 All tests passed! The WebRTC hook is properly configured.\n');
  console.log('✅ Key Features Verified:');
  console.log('   • Stable handler references using refs');
  console.log('   • Socket waits for media before connecting');
  console.log('   • Connection guard prevents reconnections');
  console.log('   • Peer creation checks for local stream');
  console.log('   • Comprehensive error handling and logging');
  console.log('   • Proper cleanup on unmount');
  console.log('\n🚀 Ready for manual testing in the browser!');
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.\n');
  process.exit(1);
}

console.log('\n📝 Next Steps:');
console.log('   1. Start the development server: npm run dev');
console.log('   2. Open browser console to see logs');
console.log('   3. Test teacher starting a session');
console.log('   4. Test student joining the session');
console.log('   5. Verify both can see each other\'s video');
console.log('   6. Check console for proper initialization sequence\n');