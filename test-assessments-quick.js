#!/usr/bin/env node

/**
 * Quick Assessment Test Suite for LearnSphere LMS
 * Fast validation of core assessment functionality
 */

const API_BASE = 'http://localhost:5000';

let testCount = 0;
let passCount = 0;

function test(name, condition, details = '') {
  testCount++;
  const status = condition ? '✅' : '❌';
  console.log(`${status} ${name}${details ? ': ' + details : ''}`);
  if (condition) passCount++;
}

async function makeRequest(method, endpoint, data = null, token = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const responseData = await response.json();
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${responseData.message || 'Request failed'}`);
  }
  
  return responseData;
}

async function quickAssessmentTest() {
  console.log('🚀 Quick Assessment Feature Test\n');
  
  try {
    // Setup users and course
    console.log('📋 Setting up test environment...');
    
    const teacherAuth = await makeRequest('POST', '/api/auth/register', {
      username: `teacher_quick_${Date.now()}`,
      email: `teacher_quick_${Date.now()}@test.com`,
      password: 'password123',
      firstName: 'Quick',
      lastName: 'Teacher',
      role: 'teacher'
    });
    
    const studentAuth = await makeRequest('POST', '/api/auth/register', {
      username: `student_quick_${Date.now()}`,
      email: `student_quick_${Date.now()}@test.com`,
      password: 'password123',
      firstName: 'Quick',
      lastName: 'Student',
      role: 'student'
    });
    
    const course = await makeRequest('POST', '/api/protected/courses', {
      title: 'Quick Test Course',
      description: 'Course for quick assessment testing',
      subject: 'Testing'
    }, teacherAuth.accessToken);
    
    await makeRequest('POST', `/api/protected/courses/${course.id}/enroll`, {}, studentAuth.accessToken);
    
    console.log('✅ Test environment ready\n');
    
    // Test 1: Create Assessment
    console.log('🎯 Testing Assessment Creation...');
    const assessment = await makeRequest('POST', `/api/protected/courses/${course.id}/assessments`, {
      title: 'Quick Test Quiz',
      description: 'A quick test assessment',
      timeLimit: 30
    }, teacherAuth.accessToken);
    test('Create Assessment', !!assessment.id);
    
    // Test 2: Add Questions
    console.log('❓ Testing Question Creation...');
    const mcQuestion = await makeRequest('POST', `/api/protected/assessments/${assessment.id}/questions`, {
      type: 'multiple_choice',
      questionText: 'What is 2 + 2?',
      options: JSON.stringify(['3', '4', '5', '6']),
      correctAnswer: '4',
      points: 2,
      order: 1
    }, teacherAuth.accessToken);
    test('Create Multiple Choice Question', !!mcQuestion.id);
    
    const tfQuestion = await makeRequest('POST', `/api/protected/assessments/${assessment.id}/questions`, {
      type: 'true_false',
      questionText: 'The sky is blue.',
      correctAnswer: 'true',
      points: 1,
      order: 2
    }, teacherAuth.accessToken);
    test('Create True/False Question', !!tfQuestion.id);
    
    // Test 3: Get Questions
    const questions = await makeRequest('GET', `/api/protected/assessments/${assessment.id}/questions`, null, teacherAuth.accessToken);
    test('Retrieve Questions', Array.isArray(questions) && questions.length === 2);
    
    // Test 4: Student Takes Assessment
    console.log('📝 Testing Assessment Taking...');
    const submission = await makeRequest('POST', `/api/protected/assessments/${assessment.id}/start`, {}, studentAuth.accessToken);
    test('Start Assessment', !!submission.id && submission.status === 'in_progress');
    
    // Test 5: Submit Answers
    await makeRequest('POST', `/api/protected/submissions/${submission.id}/answers`, {
      questionId: mcQuestion.id,
      answer: '4'
    }, studentAuth.accessToken);
    test('Submit Multiple Choice Answer', true);
    
    await makeRequest('POST', `/api/protected/submissions/${submission.id}/answers`, {
      questionId: tfQuestion.id,
      answer: 'true'
    }, studentAuth.accessToken);
    test('Submit True/False Answer', true);
    
    // Test 6: Submit Assessment
    const finalSubmission = await makeRequest('POST', `/api/protected/submissions/${submission.id}/submit`, {}, studentAuth.accessToken);
    test('Submit Assessment', finalSubmission.status === 'submitted');
    test('Score Calculation', finalSubmission.score === 3); // 2 + 1 points
    
    // Test 7: Teacher Views Results
    console.log('📊 Testing Results Management...');
    const submissions = await makeRequest('GET', `/api/protected/assessments/${assessment.id}/submissions`, null, teacherAuth.accessToken);
    test('Teacher View Submissions', Array.isArray(submissions) && submissions.length > 0);
    
    // Test 8: Assessment Status Management
    const publishedAssessment = await makeRequest('PUT', `/api/protected/assessments/${assessment.id}`, {
      status: 'published'
    }, teacherAuth.accessToken);
    test('Publish Assessment', publishedAssessment.status === 'published');
    
    console.log('\n' + '='.repeat(50));
    console.log(`🎯 Quick Test Results: ${passCount}/${testCount} passed`);
    console.log(`📊 Success Rate: ${((passCount / testCount) * 100).toFixed(1)}%`);
    
    if (passCount === testCount) {
      console.log('🎉 All assessment features working correctly!');
      return true;
    } else {
      console.log('⚠️  Some tests failed. Check the output above.');
      return false;
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    return false;
  }
}

// Run the test
quickAssessmentTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });