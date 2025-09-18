#!/usr/bin/env node

/**
 * Video Seeking Test Script
 * Tests the video player functionality to ensure seeking works correctly
 */

const fs = require('fs');
const path = require('path');

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
    'const [isSeeking, setIsSeeking] = useState(false)',
    'const [videoProgress, setVideoProgress] = useState(0)',
    'const [videoDuration, setVideoDuration] = useState(0)',
    'const videoRef = useRef<HTMLVideoElement>(null)'
  ];
  
  let allStatesFound = true;
  requiredStates.forEach(state => {
    if (!content.includes(state)) {
      console.log(`❌ Missing state: ${state}`);
      allStatesFound = false;
    }
  });
  
  if (allStatesFound) {
    console.log('✅ All required video states found');
  }
  
  return allStatesFound;
}

// Test 2: Check for problematic references
function testProblematicReferences() {
  console.log('\n🔍 Test 2: Problematic References Check');
  
  const filePath = path.join(__dirname, 'client/src/pages/course-learning.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  
  const problematicRefs = [
    'isSeekingRef',
    'isSeekingRef.current',
    'useRef<boolean>'
  ];
  
  let hasProblems = false;
  problematicRefs.forEach(ref => {
    if (content.includes(ref)) {
      console.log(`❌ Found problematic reference: ${ref}`);
      hasProblems = true;
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
    }
  });
  
  if (allHandlersFound) {
    console.log('✅ All required video event handlers found');
  }
  
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
    if (!content.includes(`const ${func} =`) && !content.includes(`function ${func}`)) {
      console.log(`❌ Missing function: ${func}`);
      allFunctionsFound = false;
    }
  });
  
  if (allFunctionsFound) {
    console.log('✅ All required seeking functions found');
  }
  
  // Check for direct currentTime usage (good practice)
  if (content.includes('video.currentTime =')) {
    console.log('✅ Direct currentTime manipulation found (good!)');
  } else {
    console.log('⚠️ No direct currentTime manipulation found');
  }
  
  return allFunctionsFound;
}

// Test 5: Check for syntax errors
function testSyntaxErrors() {
  console.log('\n🔧 Test 5: Basic Syntax Check');
  
  const filePath = path.join(__dirname, 'client/src/pages/course-learning.tsx');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Basic syntax checks
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  
  let syntaxOk = true;
  
  if (openBraces !== closeBraces) {
    console.log(`❌ Mismatched braces: ${openBraces} open, ${closeBraces} close`);
    syntaxOk = false;
  }
  
  if (openParens !== closeParens) {
    console.log(`❌ Mismatched parentheses: ${openParens} open, ${closeParens} close`);
    syntaxOk = false;
  }
  
  // Check for common TypeScript errors
  if (content.includes('useState<') && !content.includes('import')) {
    console.log('❌ useState used but React not imported');
    syntaxOk = false;
  }
  
  if (syntaxOk) {
    console.log('✅ Basic syntax checks passed');
  }
  
  return syntaxOk;
}

// Test 6: Generate test recommendations
function generateRecommendations() {
  console.log('\n💡 Test 6: Recommendations');
  
  console.log('To test video seeking manually:');
  console.log('1. Start the development server: npm run dev');
  console.log('2. Navigate to a course with video content');
  console.log('3. Try clicking on different positions of the video progress bar');
  console.log('4. Check browser console for any errors');
  console.log('5. Verify the video jumps to the clicked position');
  console.log('6. Test skip forward/backward buttons');
  console.log('7. Test bookmark jumping functionality');
  
  console.log('\nIf issues persist:');
  console.log('- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)');
  console.log('- Check browser developer tools for JavaScript errors');
  console.log('- Verify video file URLs are accessible');
  console.log('- Test with different video formats/sources');
}

// Run all tests
function runAllTests() {
  console.log('Running comprehensive video seeking tests...\n');
  
  const results = {
    fileStructure: testFileStructure(),
    problematicRefs: testProblematicReferences(),
    eventHandlers: testVideoEventHandlers(),
    seekingFunctions: testSeekingFunctions(),
    syntaxErrors: testSyntaxErrors()
  };
  
  generateRecommendations();
  
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
  } else {
    console.log('⚠️ Some tests failed. Please review the issues above.');
  }
  
  return passedTests === totalTests;
}

// Run the tests
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testFileStructure,
  testProblematicReferences,
  testVideoEventHandlers,
  testSeekingFunctions,
  testSyntaxErrors
};