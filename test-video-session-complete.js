/**
 * Comprehensive Video Session Test
 * Tests the complete video session workflow from user registration to session completion
 */

import http from 'http';

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Test configuration
const BASE_URL = 'http://localhost:5000';
const timestamp = Date.now();

// Test data
let teacherToken = '';
let studentToken = '';
let teacherId = '';
let studentId = '';
let courseId = '';
let videoSessionId = '';

// Test statistics
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

/**
 * Make HTTP request
 */
function makeRequest(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Print test header
 */
function printHeader(title) {
  console.log('\n' + colors.cyan + '='.repeat(60) + colors.reset);
  console.log(colors.bright + colors.cyan + title + colors.reset);
  console.log(colors.cyan + '='.repeat(60) + colors.reset);
}

/**
 * Print success message
 */
function printSuccess(message) {
  console.log(colors.green + '✓ ' + message + colors.reset);
}

/**
 * Print error message
 */
function printError(message) {
  console.log(colors.red + '✗ ' + message + colors.reset);
}

/**
 * Print info message
 */
function printInfo(message) {
  console.log(colors.blue + 'ℹ ' + message + colors.reset);
}

/**
 * Print warning message
 */
function printWarning(message) {
  console.log(colors.yellow + '⚠ ' + message + colors.reset);
}

/**
 * Sleep function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test runner
 */
async function runTest(testName, testFn) {
  totalTests++;
  printHeader(`STEP ${totalTests}: ${testName}`);
  
  try {
    await testFn();
    passedTests++;
    printSuccess(`${testName} passed`);
    return true;
  } catch (error) {
    failedTests++;
    printError(`Failed: ${error.message}`);
    printWarning(`Test failed: ${testName}. Stopping execution.`);
    return false;
  }
}

/**
 * Print test summary
 */
function printSummary() {
  console.log('\n' + colors.magenta + '='.repeat(60) + colors.reset);
  console.log(colors.bright + colors.magenta + 'TEST SUMMARY' + colors.reset);
  console.log(colors.magenta + '='.repeat(60) + colors.reset);
  console.log(`Total Tests: ${totalTests}`);
  console.log(colors.green + `Passed: ${passedTests}` + colors.reset);
  console.log(colors.red + `Failed: ${failedTests}` + colors.reset);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
  console.log(colors.magenta + '='.repeat(60) + colors.reset);
  
  if (failedTests === 0) {
    console.log('\n' + colors.green + colors.bright + '🎉 ALL TESTS PASSED! 🎉' + colors.reset + '\n');
  } else {
    console.log('\n' + colors.red + colors.bright + '❌ SOME TESTS FAILED' + colors.reset + '\n');
  }
}

/**
 * Check if server is running
 */
async function checkServer() {
  try {
    const response = await makeRequest('/api/health', 'GET');
    return response.statusCode === 200 || response.statusCode === 404; // 404 is ok, means server is up
  } catch (error) {
    return false;
  }
}

/**
 * Main test execution
 */
async function runTests() {
  printHeader('VIDEO SESSION COMPREHENSIVE TEST');
  console.log('Testing complete video session workflow...\n');
  
  // Check if server is running
  printInfo('Checking if server is running...');
  const serverRunning = await checkServer();
  if (!serverRunning) {
    printError('Server is not running at ' + BASE_URL);
    printWarning('Please start the server with: npm run dev');
    process.exit(1);
  }
  printSuccess('Server is running');

  // Test 1: Register Teacher
  const test1 = await runTest('Register Teacher', async () => {
    const response = await makeRequest('/api/auth/register', 'POST', {
      username: `teacher_video_${timestamp}`,
      password: 'Test123!@#',
      email: `teacher_video_${timestamp}@test.com`,
      firstName: 'Test',
      lastName: 'Teacher',
      role: 'teacher',
    });

    if (response.statusCode !== 200 && response.statusCode !== 201) {
      printError(`Status Code: ${response.statusCode}`);
      printError(`Response Body: ${JSON.stringify(response.body, null, 2)}`);
      throw new Error(`Failed to register teacher: ${response.body?.message || response.body?.error || 'Unknown error'}`);
    }

    teacherToken = response.body.accessToken;
    teacherId = response.body.user.id;
    
    printInfo(`Teacher ID: ${teacherId}`);
    printInfo('Teacher Token: Obtained');
  });

  if (!test1) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 2: Register Student
  const test2 = await runTest('Register Student', async () => {
    const response = await makeRequest('/api/auth/register', 'POST', {
      username: `student_video_${timestamp}`,
      password: 'Test123!@#',
      email: `student_video_${timestamp}@test.com`,
      firstName: 'Test',
      lastName: 'Student',
      role: 'student',
    });

    if (response.statusCode !== 200 && response.statusCode !== 201) {
      throw new Error(`Failed to register student: ${response.body?.message || 'Unknown error'}`);
    }

    studentToken = response.body.accessToken;
    studentId = response.body.user.id;
    
    printInfo(`Student ID: ${studentId}`);
    printInfo('Student Token: Obtained');
  });

  if (!test2) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 3: Create Course
  const test3 = await runTest('Create Course', async () => {
    const response = await makeRequest('/api/protected/courses', 'POST', {
      title: `Video Session Test Course ${timestamp}`,
      description: 'A course for testing video sessions',
      subject: 'Technology',
      level: 'beginner',
    }, teacherToken);

    if (response.statusCode !== 200 && response.statusCode !== 201) {
      printError(`Status Code: ${response.statusCode}`);
      printError(`Response Body: ${JSON.stringify(response.body, null, 2)}`);
      throw new Error(`Failed to create course: ${response.body?.message || 'Unknown error'}`);
    }

    courseId = response.body.id;
    printInfo(`Course ID: ${courseId}`);
  });

  if (!test3) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 4: Enroll Student
  const test4 = await runTest('Enroll Student in Course', async () => {
    const response = await makeRequest(`/api/protected/courses/${courseId}/enroll`, 'POST', {}, studentToken);

    if (response.statusCode !== 200 && response.statusCode !== 201) {
      throw new Error(`Failed to enroll student: ${response.body?.message || 'Unknown error'}`);
    }

    printInfo('Student enrolled successfully');
  });

  if (!test4) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 5: Create Video Session
  const test5 = await runTest('Create Video Session', async () => {
    const response = await makeRequest(`/api/video-sessions`, 'POST', {
      courseId: courseId,
      title: 'Live Class - Introduction to Testing',
      description: 'First live session for testing',
      scheduledAt: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
    }, teacherToken);

    if (response.statusCode !== 200 && response.statusCode !== 201) {
      throw new Error(`Failed to create video session: ${response.body?.message || 'Unknown error'}`);
    }

    videoSessionId = response.body.id;
    printInfo(`Video Session ID: ${videoSessionId}`);
    printInfo(`Status: ${response.body.status}`);
  });

  if (!test5) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 6: Start Video Session
  const test6 = await runTest('Start Video Session', async () => {
    const response = await makeRequest(`/api/video-sessions/${videoSessionId}/start`, 'POST', {}, teacherToken);

    if (response.statusCode !== 200) {
      throw new Error(`Failed to start video session: ${response.body?.message || 'Unknown error'}`);
    }

    printInfo(`Session started - Status: ${response.body.status}`);
  });

  if (!test6) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 7: Fetch Course Video Sessions (Student)
  const test7 = await runTest('Fetch Course Video Sessions (Student)', async () => {
    const response = await makeRequest(`/api/courses/${courseId}/video-sessions`, 'GET', null, studentToken);

    if (response.statusCode !== 200) {
      throw new Error(`Failed to fetch video sessions: ${response.statusCode} ${response.body?.message || 'Unknown error'}`);
    }

    if (!Array.isArray(response.body)) {
      throw new Error('Expected array of video sessions');
    }

    const activeSession = response.body.find(s => s.id === videoSessionId);
    if (!activeSession) {
      throw new Error('Created video session not found in list');
    }

    printInfo(`Found ${response.body.length} video session(s)`);
    printInfo(`Active session status: ${activeSession.status}`);
  });

  if (!test7) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 8: Get Video Session Details
  const test8 = await runTest('Get Video Session Details', async () => {
    const response = await makeRequest(`/api/video-sessions/${videoSessionId}`, 'GET', null, studentToken);

    if (response.statusCode !== 200) {
      throw new Error(`Failed to get video session details: ${response.body?.message || 'Unknown error'}`);
    }

    printInfo(`Session Title: ${response.body.title}`);
    printInfo(`Session Status: ${response.body.status}`);
  });

  if (!test8) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 9: Student Joins Session
  const test9 = await runTest('Student Joins Video Session', async () => {
    const response = await makeRequest(`/api/video-sessions/${videoSessionId}/join`, 'POST', {}, studentToken);

    if (response.statusCode !== 200) {
      throw new Error(`Failed to join video session: ${response.body?.message || 'Unknown error'}`);
    }

    printInfo('Student joined session successfully');
  });

  if (!test9) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 10: Get Participants
  const test10 = await runTest('Get Session Participants', async () => {
    const response = await makeRequest(`/api/video-sessions/${videoSessionId}/participants`, 'GET', null, teacherToken);

    if (response.statusCode !== 200) {
      throw new Error(`Failed to get participants: ${response.body?.message || 'Unknown error'}`);
    }

    if (!Array.isArray(response.body)) {
      throw new Error('Expected array of participants');
    }

    printInfo(`Total participants: ${response.body.length}`);
    printInfo(`Participants: ${JSON.stringify(response.body.map(p => ({ userId: p.userId, role: p.role })))}`);

    const studentParticipant = response.body.find(p => p.userId === studentId);

    if (!studentParticipant) {
      throw new Error('Student not found in participants');
    }

    printInfo('✓ Student is in participants');
    
    // Teacher may or may not be in participants depending on whether they explicitly joined
    const teacherParticipant = response.body.find(p => p.userId === teacherId);
    if (teacherParticipant) {
      printInfo('✓ Teacher is in participants');
    } else {
      printInfo('ℹ Teacher has not explicitly joined (host may not need to join)');
    }
  });

  if (!test10) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 11: Teacher Sends Chat Message
  const test11 = await runTest('Teacher Sends Chat Message', async () => {
    const response = await makeRequest(`/api/video-sessions/${videoSessionId}/messages`, 'POST', {
      message: 'Welcome to the live session!',
    }, teacherToken);

    if (response.statusCode !== 200 && response.statusCode !== 201) {
      throw new Error(`Failed to send message: ${response.body?.message || 'Unknown error'}`);
    }

    printInfo('Teacher message sent successfully');
  });

  if (!test11) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 12: Student Sends Chat Message
  const test12 = await runTest('Student Sends Chat Message', async () => {
    const response = await makeRequest(`/api/video-sessions/${videoSessionId}/messages`, 'POST', {
      message: 'Thank you, teacher!',
    }, studentToken);

    if (response.statusCode !== 200 && response.statusCode !== 201) {
      throw new Error(`Failed to send message: ${response.body?.message || 'Unknown error'}`);
    }

    printInfo('Student message sent successfully');
  });

  if (!test12) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 13: Get Chat Messages
  const test13 = await runTest('Get Chat Messages', async () => {
    const response = await makeRequest(`/api/video-sessions/${videoSessionId}/messages`, 'GET', null, studentToken);

    if (response.statusCode !== 200) {
      throw new Error(`Failed to get messages: ${response.body?.message || 'Unknown error'}`);
    }

    if (!Array.isArray(response.body)) {
      throw new Error('Expected array of messages');
    }

    if (response.body.length < 2) {
      throw new Error(`Expected at least 2 messages, got ${response.body.length}`);
    }

    printInfo(`Total messages: ${response.body.length}`);
    printInfo(`First message: "${response.body[0].message}"`);
    printInfo(`Last message: "${response.body[response.body.length - 1].message}"`);
  });

  if (!test13) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 14: Student Leaves Session
  const test14 = await runTest('Student Leaves Video Session', async () => {
    const response = await makeRequest(`/api/video-sessions/${videoSessionId}/leave`, 'POST', {}, studentToken);

    if (response.statusCode !== 200) {
      throw new Error(`Failed to leave video session: ${response.body?.message || 'Unknown error'}`);
    }

    printInfo('Student left session successfully');
  });

  if (!test14) {
    printSummary();
    process.exit(1);
  }

  await sleep(500);

  // Test 15: End Video Session
  const test15 = await runTest('End Video Session', async () => {
    const response = await makeRequest(`/api/video-sessions/${videoSessionId}/end`, 'POST', {}, teacherToken);

    if (response.statusCode !== 200) {
      throw new Error(`Failed to end video session: ${response.body?.message || 'Unknown error'}`);
    }

    printInfo(`Session ended - Status: ${response.body.status}`);
  });

  if (!test15) {
    printSummary();
    process.exit(1);
  }

  // Print final summary
  printSummary();
  
  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the tests
console.log(colors.bright + '\n🚀 Starting Video Session Comprehensive Test...\n' + colors.reset);
runTests().catch((error) => {
  console.error(colors.red + '\n❌ Test execution failed:' + colors.reset);
  console.error(error);
  process.exit(1);
});