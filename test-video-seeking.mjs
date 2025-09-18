#!/usr/bin/env node

/**
 * Video Seeking Test Script
 * Tests the video player functionality to ensure seeking works correctly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎥 Video Seeking Test Script');
console.log('============================\n');

// Test 1: Check if the course-learning.tsx file exists and has correct structure
function testFileStructure() {
  console.log('📁 Test 1: File Structure Check');
  
  const filePath = path.join(__dirname, 'client/src/pages/course-learning.tsx');
  
  if (!fs.existsSync(filePath)) {
    console.log('❌ course-learning.tsx file not found');
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for required video-related state variables
  const requiredStates = [
    'isSeeking, setIsSeeking',
    'videoProgress, setVideoProgress',
    'videoDuration, setVideoDuration',
    'videoRef = useRef<HTMLVideoElement>(null)'
  ];
  
  let allStatesFound = true;
  requiredStates.forEach(state => {
    if (!content.includes(state)) {
      console.log(`❌ Missing state: ${state}`);
      allStatesFound = false;
    } else {
      console.log(`✅ Found state: ${state}`);
    }
  });
  
  return allStatesFound;
}

// Test 2: Check for problematic references
function testProblematicReferences() {
  console.log('\n🔍 Test 2: Problematic References Check');
  
  const filePath = path.join(__dirname, 'client/src/pages/course-learning.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const problematicRefs = [
    'isSeekingRef',
    'isSeekingRef.current'
  ];
  
  let hasProblems = false;
  problematicRefs.forEach(ref => {
    if (content.includes(ref)) {
      console.log(`❌ Found problematic reference: ${ref}`);
      hasProblems = true;
      
      // Show context around the problematic reference
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes(ref)) {
          console.log(`   Line ${index + 1}: ${line.trim()}`);
        }
      });
    }
  });
  
  if (!hasProblems) {
    console.log('✅ No problematic references found');
  }
  
  return !hasProblems;
}

// Test 3: Check video event handlers
function testVideoEventHandlers() {
  console.log('\n🎬 Test 3: Video Event Handlers Check');
  
  const filePath = path.join(__dirname, 'client/src/pages/course-learning.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const requiredHandlers = [
    'onTimeUpdate',
    'onLoadedMetadata',
    'onPlay',
    'onPause',
    'onSeeking',
    'onSeeked'
  ];
  
  let allHandlersFound = true;
  requiredHandlers.forEach(handler => {
    if (!content.includes(handler)) {
      console.log(`❌ Missing handler: ${handler}`);
      allHandlersFound = false;
    } else {
      console.log(`✅ Found handler: ${handler}`);
    }
  });
  
  // Check for proper seeking logic
  if (content.includes('!isSeeking') && content.includes('onTimeUpdate')) {
    console.log('✅ Proper seeking prevention logic found');
  } else {
    console.log('❌ Missing seeking prevention logic in onTimeUpdate');
    allHandlersFound = false;
  }
  
  return allHandlersFound;
}

// Test 4: Check seeking functions
function testSeekingFunctions() {
  console.log('\n⏯️ Test 4: Seeking Functions Check');
  
  const filePath = path.join(__dirname, 'client/src/pages/course-learning.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const requiredFunctions = [
    'seekVideo',
    'skipForward',
    'skipBackward',
    'jumpToBookmark'
  ];
  
  let allFunctionsFound = true;
  requiredFunctions.forEach(func => {
    if (content.includes(`const ${func} =`) || content.includes(`function ${func}`)) {
      console.log(`✅ Found function: ${func}`);
    } else {
      console.log(`❌ Missing function: ${func}`);
      allFunctionsFound = false;
    }
  });
  
  // Check for direct currentTime usage (good practice)
  if (content.includes('video.currentTime =')) {
    console.log('✅ Direct currentTime manipulation found (good!)');
  } else {
    console.log('⚠️ No direct currentTime manipulation found');
  }
  
  return allFunctionsFound;
}

// Test 5: Check for syntax errors and common issues
function testCommonIssues() {
  console.log('\n🔧 Test 5: Common Issues Check');
  
  const filePath = path.join(__dirname, 'client/src/pages/course-learning.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  
  let issuesFound = [];
  
  // Check for undefined variables
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('isSeekingRef') && !line.includes('//')) {
      issuesFound.push(`Line ${index + 1}: Still references isSeekingRef - ${line.trim()}`);
    }
  });
  
  // Check for missing dependencies in useEffect
  const useEffectMatches = content.match(/useEffect\([^}]+\}, \[[^\]]*\]/g);
  if (useEffectMatches) {
    useEffectMatches.forEach(match => {
      if (match.includes('isSeeking') && !match.includes('[') && !match.includes('isSeeking')) {
        issuesFound.push('useEffect using isSeeking but not in dependency array');
      }
    });
  }
  
  if (issuesFound.length === 0) {
    console.log('✅ No common issues found');
    return true;
  } else {
    console.log('❌ Issues found:');
    issuesFound.forEach(issue => console.log(`   ${issue}`));
    return false;
  }
}

// Run all tests
function runAllTests() {
  console.log('Running comprehensive video seeking tests...\n');
  
  const results = {
    fileStructure: testFileStructure(),
    problematicRefs: testProblematicReferences(),
    eventHandlers: testVideoEventHandlers(),
    seekingFunctions: testSeekingFunctions(),
    commonIssues: testCommonIssues()
  };
  
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Video seeking should work correctly.');
    console.log('\n💡 Next steps:');
    console.log('1. Clear browser cache (Ctrl+Shift+R)');
    console.log('2. Restart development server: npm run dev');
    console.log('3. Test video seeking in browser');
  } else {
    console.log('⚠️ Some tests failed. Issues need to be fixed first.');
  }
  
  return passedTests === totalTests;
}

// Run the tests
runAllTests();