import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

// Helper function to make authenticated requests
async function makeRequest(method, endpoint, data = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  return response;
}

// Simulate the UI workflow
async function testUIWorkflow() {
  console.log('🧪 Starting UI Workflow Test\n');
  
  const timestamp = Date.now();
  const teacherEmail = `test.teacher.${timestamp}@example.com`;
  const studentEmail = `test.student.${timestamp}@example.com`;
  
  try {
    console.log('=== SETUP ===');
    
    // Register and login teacher
    console.log(`Registering teacher: ${teacherEmail}`);
    const teacherRegRes = await makeRequest('POST', '/api/auth/register', {
      username: `testteacher${timestamp}`,
      email: teacherEmail,
      password: 'password123',
      firstName: 'Test',
      lastName: 'Teacher',
      role: 'teacher'
    });
    
    if (!teacherRegRes.ok) {
      const errorData = await teacherRegRes.json();
      throw new Error(`Failed to register teacher: ${errorData.message}`);
    }
    console.log(`✓ Registered ${teacherEmail}`);
    
    console.log(`Logging in ${teacherEmail}`);
    const teacherLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: teacherEmail,
      password: 'password123'
    });
    
    if (!teacherLoginRes.ok) {
      const errorData = await teacherLoginRes.json();
      throw new Error(`Failed to login teacher: ${errorData.message}`);
    }
    
    const teacherAuth = await teacherLoginRes.json();
    const teacherToken = teacherAuth.accessToken;
    console.log(`✓ Logged in ${teacherEmail}`);
    
    // Register and login student
    console.log(`Registering student: ${studentEmail}`);
    const studentRegRes = await makeRequest('POST', '/api/auth/register', {
      username: `teststudent${timestamp}`,
      email: studentEmail,
      password: 'password123',
      firstName: 'Test',
      lastName: 'Student',
      role: 'student'
    });
    
    if (!studentRegRes.ok) {
      const errorData = await studentRegRes.json();
      throw new Error(`Failed to register student: ${errorData.message}`);
    }
    console.log(`✓ Registered ${studentEmail}`);
    
    console.log(`Logging in ${studentEmail}`);
    const studentLoginRes = await makeRequest('POST', '/api/auth/login', {
      email: studentEmail,
      password: 'password123'
    });
    
    if (!studentLoginRes.ok) {
      const errorData = await studentLoginRes.json();
      throw new Error(`Failed to login student: ${errorData.message}`);
    }
    
    const studentAuth = await studentLoginRes.json();
    const studentToken = studentAuth.accessToken;
    console.log(`✓ Logged in ${studentEmail}`);
    
    // Create a course
    console.log('Creating test course...');
    const courseRes = await makeRequest('POST', '/api/protected/courses', {
      title: 'Test Course for UI Workflow',
      subject: 'Testing',
      description: 'A test course for UI workflow testing',
      objectives: 'Test objectives',
      category: 'test',
      targetAudience: 'beginner',
      duration: '1 hour'
    }, teacherToken);
    
    if (!courseRes.ok) {
      const errorData = await courseRes.json();
      throw new Error(`Failed to create course: ${errorData.message}`);
    }
    
    const course = await courseRes.json();
    const courseId = course.id;
    console.log(`✓ Created course: ${course.title} (ID: ${courseId})`);
    
    // Enroll student
    console.log('Enrolling student in course...');
    await makeRequest('POST', `/api/protected/courses/${courseId}/enroll`, {}, studentToken);
    console.log('✓ Student enrolled in course');
    
    console.log('\n=== SIMULATING UI WORKFLOW ===\n');
    
    // Step 1: Student visits main discussions page (simulates initial load)
    console.log('--- Step 1: Student visits main discussions page ---');
    
    // First, get courses (this is what the UI does)
    const coursesRes = await makeRequest('GET', '/api/protected/courses', null, studentToken);
    if (!coursesRes.ok) {
      const errorData = await coursesRes.json();
      throw new Error(`Failed to get courses: ${errorData.message}`);
    }
    const courses = await coursesRes.json();
    console.log(`Found ${courses.length} courses`);
    
    // Then get discussions for each course (simulating the discussions page query)
    const discussionPromises = courses.map(async (course) => {
      const res = await makeRequest('GET', `/api/protected/courses/${course.id}/discussions`, null, studentToken);
      const discussions = await res.json();
      return discussions.map(discussion => ({
        ...discussion,
        courseName: course.title,
        courseSubject: course.subject,
      }));
    });
    const discussionArrays = await Promise.all(discussionPromises);
    const allDiscussions = discussionArrays.flat();
    console.log(`✓ Found ${allDiscussions.length} discussions from main page`);
    
    // Step 2: Student visits course detail page
    console.log('\n--- Step 2: Student visits course detail page ---');
    const courseDiscussionsRes = await makeRequest('GET', `/api/protected/courses/${courseId}/discussions`, null, studentToken);
    const courseDiscussions = await courseDiscussionsRes.json();
    console.log(`✓ Found ${courseDiscussions.length} discussions from course page`);
    
    // Step 3: Student creates a discussion from course detail page (redirects to discussions/create)
    console.log('\n--- Step 3: Student creates discussion ---');
    const discussionData = {
      title: 'UI Workflow Test Discussion',
      description: 'Testing the UI workflow for discussion creation'
    };
    
    const createRes = await makeRequest('POST', `/api/protected/courses/${courseId}/discussions`, discussionData, studentToken);
    const newDiscussion = await createRes.json();
    console.log(`✓ Created discussion: ${newDiscussion.title} (ID: ${newDiscussion.id})`);
    
    // Step 4: Simulate what happens after discussion creation
    console.log('\n--- Step 4: Verifying immediate visibility ---');
    
    // Wait a moment to simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check main discussions page (simulating cache invalidation and refetch)
    console.log('Checking main discussions page...');
    const coursesRes2 = await makeRequest('GET', '/api/protected/courses', null, studentToken);
    const courses2 = await coursesRes2.json();
    
    const discussionPromises2 = courses2.map(async (course) => {
      const res = await makeRequest('GET', `/api/protected/courses/${course.id}/discussions`, null, studentToken);
      const discussions = await res.json();
      return discussions.map(discussion => ({
        ...discussion,
        courseName: course.title,
        courseSubject: course.subject,
      }));
    });
    const discussionArrays2 = await Promise.all(discussionPromises2);
    const allDiscussions2 = discussionArrays2.flat();
    
    const foundInMain = allDiscussions2.find(d => d.id === newDiscussion.id);
    if (foundInMain) {
      console.log('✓ Discussion found in main discussions page');
      console.log(`  Title: ${foundInMain.title}`);
      console.log(`  Course: ${foundInMain.courseName}`);
    } else {
      console.log('❌ Discussion NOT found in main discussions page');
    }
    
    // Check course detail page
    console.log('Checking course detail page...');
    const courseDiscussionsRes2 = await makeRequest('GET', `/api/protected/courses/${courseId}/discussions`, null, studentToken);
    const courseDiscussions2 = await courseDiscussionsRes2.json();
    
    const foundInCourse = courseDiscussions2.find(d => d.id === newDiscussion.id);
    if (foundInCourse) {
      console.log('✓ Discussion found in course detail page');
      console.log(`  Title: ${foundInCourse.title}`);
    } else {
      console.log('❌ Discussion NOT found in course detail page');
    }
    
    // Step 5: Test with different timing scenarios
    console.log('\n--- Step 5: Testing timing scenarios ---');
    
    // Create another discussion and check immediately (no delay)
    const discussionData2 = {
      title: 'Immediate Check Discussion',
      description: 'Testing immediate visibility'
    };
    
    const createRes2 = await makeRequest('POST', `/api/protected/courses/${courseId}/discussions`, discussionData2, studentToken);
    const newDiscussion2 = await createRes2.json();
    console.log(`✓ Created second discussion: ${newDiscussion2.title} (ID: ${newDiscussion2.id})`);
    
    // Check immediately (no delay)
    const courseDiscussionsRes3 = await makeRequest('GET', `/api/protected/courses/${courseId}/discussions`, null, studentToken);
    const courseDiscussions3 = await courseDiscussionsRes3.json();
    
    const foundImmediate = courseDiscussions3.find(d => d.id === newDiscussion2.id);
    if (foundImmediate) {
      console.log('✓ Second discussion found immediately in course detail page');
    } else {
      console.log('❌ Second discussion NOT found immediately in course detail page');
    }
    
    console.log('\n=== TEST RESULTS ===');
    console.log(`First Discussion (${newDiscussion.title}):`);
    console.log(`  Main Page: ${foundInMain ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`  Course Page: ${foundInCourse ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`Second Discussion (${newDiscussion2.title}):`);
    console.log(`  Course Page (Immediate): ${foundImmediate ? '✓ PASS' : '❌ FAIL'}`);
    
    const allPassed = foundInMain && foundInCourse && foundImmediate;
    console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (!allPassed) {
      console.log('\n🔍 DEBUGGING INFO:');
      console.log(`Total discussions in course: ${courseDiscussions3.length}`);
      console.log('Discussion IDs in course:', courseDiscussions3.map(d => d.id));
      console.log(`Total discussions in main page: ${allDiscussions2.length}`);
      console.log('Discussion IDs in main page:', allDiscussions2.map(d => d.id));
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error);
  }
}

// Run the test
testUIWorkflow();