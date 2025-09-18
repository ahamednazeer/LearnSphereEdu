#!/usr/bin/env node

/**
 * Test script to verify discussion creation and visibility
 * This script tests that discussions appear in both:
 * 1. The main discussions page
 * 2. Within the specific course detail page
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

// Generate unique test data for each run
const timestamp = Date.now();
const testUser = {
  username: `teststudent${timestamp}`,
  email: `test.student.${timestamp}@example.com`,
  password: 'password123',
  firstName: 'Test',
  lastName: 'Student',
  role: 'student'
};

const testTeacher = {
  username: `testteacher${timestamp}`,
  email: `test.teacher.${timestamp}@example.com`,
  password: 'password123',
  firstName: 'Test',
  lastName: 'Teacher',
  role: 'teacher'
};

let studentToken = '';
let teacherToken = '';
let testCourseId = '';
let testDiscussionId = '';

async function makeRequest(method, endpoint, data = null, token = '') {
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
  const responseData = await response.json();
  
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed: ${responseData.message || response.statusText}`);
  }
  
  return responseData;
}

async function registerAndLogin(userData) {
  console.log(`Registering ${userData.role}: ${userData.email}`);
  
  try {
    await makeRequest('POST', '/api/auth/register', userData);
    console.log(`✓ Registered ${userData.email}`);
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`- User ${userData.email} already exists, skipping registration`);
    } else {
      throw error;
    }
  }

  console.log(`Logging in ${userData.email}`);
  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    email: userData.email,
    password: userData.password
  });
  
  console.log(`✓ Logged in ${userData.email}`);
  // The response contains accessToken, not token
  return loginResponse.accessToken;
}

async function createTestCourse(token) {
  console.log('Creating test course...');
  
  const courseData = {
    title: 'Test Course for Discussions',
    subject: 'Computer Science',
    description: 'A test course to verify discussion functionality',
    objectives: 'Test discussion creation and visibility',
    targetAudience: 'beginner',
    duration: '4 weeks'
  };

  const course = await makeRequest('POST', '/api/protected/courses', courseData, token);
  console.log(`✓ Created course: ${course.title} (ID: ${course.id})`);
  return course.id;
}

async function enrollStudentInCourse(courseId, studentToken) {
  console.log('Enrolling student in course...');
  
  try {
    await makeRequest('POST', `/api/protected/courses/${courseId}/enroll`, {}, studentToken);
    console.log('✓ Student enrolled in course');
  } catch (error) {
    if (error.message.includes('already enrolled')) {
      console.log('- Student already enrolled, continuing');
    } else {
      throw error;
    }
  }
}

async function createDiscussion(courseId, token, title, description) {
  console.log(`Creating discussion: ${title}`);
  
  const discussionData = {
    title,
    description,
    courseId
  };

  const discussion = await makeRequest('POST', `/api/protected/courses/${courseId}/discussions`, discussionData, token);
  console.log(`✓ Created discussion: ${discussion.title} (ID: ${discussion.id})`);
  return discussion;
}

async function getDiscussionsFromMainPage(token) {
  console.log('Fetching discussions from main discussions page...');
  
  // First get courses to simulate the main discussions page behavior
  const courses = await makeRequest('GET', '/api/protected/courses', null, token);
  console.log(`Found ${courses.length} courses`);
  
  // Get discussions from all courses (simulating the main discussions page logic)
  const allDiscussions = [];
  for (const course of courses) {
    try {
      const discussions = await makeRequest('GET', `/api/protected/courses/${course.id}/discussions`, null, token);
      const discussionsWithCourseInfo = discussions.map(discussion => ({
        ...discussion,
        courseName: course.title,
        courseSubject: course.subject
      }));
      allDiscussions.push(...discussionsWithCourseInfo);
    } catch (error) {
      console.log(`- No discussions found for course ${course.title}`);
    }
  }
  
  console.log(`✓ Found ${allDiscussions.length} discussions from main page`);
  return allDiscussions;
}

async function getDiscussionsFromCoursePage(courseId, token) {
  console.log('Fetching discussions from course detail page...');
  
  const discussions = await makeRequest('GET', `/api/protected/courses/${courseId}/discussions`, null, token);
  console.log(`✓ Found ${discussions.length} discussions from course page`);
  return discussions;
}

async function verifyDiscussionVisibility(discussionId, courseId, token) {
  console.log('\n=== VERIFYING DISCUSSION VISIBILITY ===');
  
  // Check main discussions page
  const mainPageDiscussions = await getDiscussionsFromMainPage(token);
  const foundInMainPage = mainPageDiscussions.find(d => d.id === discussionId);
  
  if (foundInMainPage) {
    console.log('✓ Discussion found in main discussions page');
    console.log(`  Title: ${foundInMainPage.title}`);
    console.log(`  Course: ${foundInMainPage.courseName}`);
  } else {
    console.log('✗ Discussion NOT found in main discussions page');
    console.log('Available discussions in main page:');
    mainPageDiscussions.forEach(d => console.log(`  - ${d.title} (${d.id})`));
  }
  
  // Check course detail page
  const coursePageDiscussions = await getDiscussionsFromCoursePage(courseId, token);
  const foundInCoursePage = coursePageDiscussions.find(d => d.id === discussionId);
  
  if (foundInCoursePage) {
    console.log('✓ Discussion found in course detail page');
    console.log(`  Title: ${foundInCoursePage.title}`);
  } else {
    console.log('✗ Discussion NOT found in course detail page');
    console.log('Available discussions in course page:');
    coursePageDiscussions.forEach(d => console.log(`  - ${d.title} (${d.id})`));
  }
  
  return {
    foundInMainPage: !!foundInMainPage,
    foundInCoursePage: !!foundInCoursePage
  };
}

async function runTest() {
  console.log('🧪 Starting Discussion Creation Test\n');
  
  try {
    // Setup: Register and login users
    console.log('=== SETUP ===');
    teacherToken = await registerAndLogin(testTeacher);
    studentToken = await registerAndLogin(testUser);
    
    // Create a test course
    testCourseId = await createTestCourse(teacherToken);
    
    // Enroll student in course
    await enrollStudentInCourse(testCourseId, studentToken);
    
    console.log('\n=== TESTING DISCUSSION CREATION ===');
    
    // Test 1: Create discussion as student
    console.log('\n--- Test 1: Student creates discussion ---');
    const studentDiscussion = await createDiscussion(
      testCourseId, 
      studentToken, 
      'Student Discussion Test', 
      'This is a test discussion created by a student'
    );
    
    // Wait a moment for any async operations
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const studentResult = await verifyDiscussionVisibility(studentDiscussion.id, testCourseId, studentToken);
    
    // Test 2: Create discussion as teacher
    console.log('\n--- Test 2: Teacher creates discussion ---');
    const teacherDiscussion = await createDiscussion(
      testCourseId, 
      teacherToken, 
      'Teacher Discussion Test', 
      'This is a test discussion created by a teacher'
    );
    
    // Wait a moment for any async operations
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const teacherResult = await verifyDiscussionVisibility(teacherDiscussion.id, testCourseId, teacherToken);
    
    // Summary
    console.log('\n=== TEST RESULTS ===');
    console.log('Student Discussion:');
    console.log(`  Main Page: ${studentResult.foundInMainPage ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Course Page: ${studentResult.foundInCoursePage ? '✓ PASS' : '✗ FAIL'}`);
    
    console.log('Teacher Discussion:');
    console.log(`  Main Page: ${teacherResult.foundInMainPage ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Course Page: ${teacherResult.foundInCoursePage ? '✓ PASS' : '✗ FAIL'}`);
    
    const allPassed = studentResult.foundInMainPage && studentResult.foundInCoursePage && 
                     teacherResult.foundInMainPage && teacherResult.foundInCoursePage;
    
    console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (!allPassed) {
      console.log('\n🔍 Issue Analysis:');
      if (!studentResult.foundInCoursePage || !teacherResult.foundInCoursePage) {
        console.log('- Discussions are not appearing in course detail pages');
        console.log('- This suggests the course-specific discussion query is not being invalidated properly');
      }
      if (!studentResult.foundInMainPage || !teacherResult.foundInMainPage) {
        console.log('- Discussions are not appearing in main discussions page');
        console.log('- This suggests the general discussions query is not being invalidated properly');
      }
    }
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  process.exit(1);
});

// Run the test
runTest();