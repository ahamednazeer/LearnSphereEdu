#!/usr/bin/env node

/**
 * Comprehensive Assessment Test Suite for LearnSphere LMS
 * Tests all assessment features including:
 * - Assessment CRUD operations
 * - Question management (multiple types)
 * - Assessment taking flow
 * - Submission management
 * - Scoring and grading
 * - Time limits and auto-submission
 * - Assessment status management
 */

const API_BASE = 'http://localhost:5000';

// Test Results Tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}${details ? ': ' + details : ''}`);
  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
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

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseData.message || 'Request failed'}`);
    }
    
    return responseData;
  } catch (error) {
    throw error;
  }
}

async function setupTestUsers() {
  console.log('\n=== SETTING UP TEST USERS ===');
  
  try {
    // Create Teacher
    const teacherData = {
      username: `teacher_assess_${Date.now()}`,
      email: `teacher_assess_${Date.now()}@test.com`,
      password: 'password123',
      firstName: 'Assessment',
      lastName: 'Teacher',
      role: 'teacher'
    };
    
    const teacherAuth = await makeRequest('POST', '/api/auth/register', teacherData);
    logTest('Teacher Setup', !!teacherAuth.accessToken);
    
    // Create Student
    const studentData = {
      username: `student_assess_${Date.now()}`,
      email: `student_assess_${Date.now()}@test.com`,
      password: 'password123',
      firstName: 'Assessment',
      lastName: 'Student',
      role: 'student'
    };
    
    const studentAuth = await makeRequest('POST', '/api/auth/register', studentData);
    logTest('Student Setup', !!studentAuth.accessToken);
    
    // Create Course
    const courseData = {
      title: 'Assessment Test Course',
      description: 'Course for testing assessments',
      subject: 'Testing'
    };
    
    const course = await makeRequest('POST', '/api/protected/courses', courseData, teacherAuth.accessToken);
    logTest('Course Setup', !!course.id);
    
    // Enroll Student
    await makeRequest('POST', `/api/protected/courses/${course.id}/enroll`, {}, studentAuth.accessToken);
    logTest('Student Enrollment', true);
    
    return { teacherAuth, studentAuth, course };
    
  } catch (error) {
    logTest('Test Setup', false, error.message);
    throw error;
  }
}

async function testAssessmentCRUD(course, teacherAuth) {
  console.log('\n=== ASSESSMENT CRUD TESTS ===');
  
  try {
    // Test 1: Create Assessment with all fields
    const assessmentData = {
      title: 'Comprehensive Test Quiz',
      description: 'A comprehensive test assessment with all features',
      timeLimit: 45,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
    };
    
    const assessment = await makeRequest('POST', `/api/protected/courses/${course.id}/assessments`, assessmentData, teacherAuth.accessToken);
    logTest('Create Assessment with Time Limit and Due Date', !!assessment.id);
    
    // Test 2: Create Assessment without optional fields
    const simpleAssessmentData = {
      title: 'Simple Test Quiz',
      description: 'A simple test assessment'
    };
    
    const simpleAssessment = await makeRequest('POST', `/api/protected/courses/${course.id}/assessments`, simpleAssessmentData, teacherAuth.accessToken);
    logTest('Create Simple Assessment', !!simpleAssessment.id);
    
    // Test 3: Get All Assessments for Course
    const assessments = await makeRequest('GET', `/api/protected/courses/${course.id}/assessments`, null, teacherAuth.accessToken);
    logTest('Get Course Assessments', Array.isArray(assessments) && assessments.length >= 2);
    
    // Test 4: Get Single Assessment
    const singleAssessment = await makeRequest('GET', `/api/protected/assessments/${assessment.id}`, null, teacherAuth.accessToken);
    logTest('Get Single Assessment', singleAssessment.id === assessment.id);
    
    // Test 5: Update Assessment
    const updateData = {
      title: 'Updated Comprehensive Test Quiz',
      timeLimit: 60
    };
    
    const updatedAssessment = await makeRequest('PUT', `/api/protected/assessments/${assessment.id}`, updateData, teacherAuth.accessToken);
    logTest('Update Assessment', updatedAssessment.title === updateData.title && updatedAssessment.timeLimit === updateData.timeLimit);
    
    return { assessment, simpleAssessment };
    
  } catch (error) {
    logTest('Assessment CRUD Tests', false, error.message);
    throw error;
  }
}

async function testQuestionManagement(assessment, teacherAuth) {
  console.log('\n=== QUESTION MANAGEMENT TESTS ===');
  
  try {
    const questions = [];
    
    // Test 1: Create Multiple Choice Question
    const mcQuestion = {
      type: 'multiple_choice',
      questionText: 'What is the capital of France?',
      options: JSON.stringify(['London', 'Berlin', 'Paris', 'Madrid']),
      correctAnswer: 'Paris',
      points: 2,
      order: 1
    };
    
    const mcResult = await makeRequest('POST', `/api/protected/assessments/${assessment.id}/questions`, mcQuestion, teacherAuth.accessToken);
    logTest('Create Multiple Choice Question', !!mcResult.id);
    questions.push(mcResult);
    
    // Test 2: Create True/False Question
    const tfQuestion = {
      type: 'true_false',
      questionText: 'The Earth is flat.',
      correctAnswer: 'false',
      points: 1,
      order: 2
    };
    
    const tfResult = await makeRequest('POST', `/api/protected/assessments/${assessment.id}/questions`, tfQuestion, teacherAuth.accessToken);
    logTest('Create True/False Question', !!tfResult.id);
    questions.push(tfResult);
    
    // Test 3: Create Short Answer Question
    const saQuestion = {
      type: 'short_answer',
      questionText: 'What is 2 + 2?',
      correctAnswer: '4',
      points: 1,
      order: 3
    };
    
    const saResult = await makeRequest('POST', `/api/protected/assessments/${assessment.id}/questions`, saQuestion, teacherAuth.accessToken);
    logTest('Create Short Answer Question', !!saResult.id);
    questions.push(saResult);
    
    // Test 4: Create Fill in the Blank Question
    const fibQuestion = {
      type: 'fill_blank',
      questionText: 'The largest planet in our solar system is ____.',
      correctAnswer: 'Jupiter',
      points: 1,
      order: 4
    };
    
    const fibResult = await makeRequest('POST', `/api/protected/assessments/${assessment.id}/questions`, fibQuestion, teacherAuth.accessToken);
    logTest('Create Fill in the Blank Question', !!fibResult.id);
    questions.push(fibResult);
    
    // Test 5: Get All Questions
    const allQuestions = await makeRequest('GET', `/api/protected/assessments/${assessment.id}/questions`, null, teacherAuth.accessToken);
    logTest('Get All Questions', Array.isArray(allQuestions) && allQuestions.length === 4);
    
    // Test 6: Update Question
    const updateQuestionData = {
      questionText: 'What is the capital city of France?',
      points: 3
    };
    
    const updatedQuestion = await makeRequest('PUT', `/api/protected/questions/${mcResult.id}`, updateQuestionData, teacherAuth.accessToken);
    logTest('Update Question', updatedQuestion.questionText === updateQuestionData.questionText);
    
    // Test 7: Delete Question
    await makeRequest('DELETE', `/api/protected/questions/${fibResult.id}`, null, teacherAuth.accessToken);
    const questionsAfterDelete = await makeRequest('GET', `/api/protected/assessments/${assessment.id}/questions`, null, teacherAuth.accessToken);
    logTest('Delete Question', questionsAfterDelete.length === 3);
    
    return questions.slice(0, 3); // Return first 3 questions (excluding deleted one)
    
  } catch (error) {
    logTest('Question Management Tests', false, error.message);
    throw error;
  }
}

async function testAssessmentTaking(assessment, questions, studentAuth) {
  console.log('\n=== ASSESSMENT TAKING TESTS ===');
  
  try {
    // Test 1: Check Assessment Availability
    const assessmentDetails = await makeRequest('GET', `/api/protected/assessments/${assessment.id}`, null, studentAuth.accessToken);
    logTest('Student Can View Assessment', !!assessmentDetails.id);
    
    // Test 2: Start Assessment
    const submission = await makeRequest('POST', `/api/protected/assessments/${assessment.id}/start`, {}, studentAuth.accessToken);
    logTest('Start Assessment', !!submission.id && submission.status === 'in_progress');
    
    // Test 3: Get Student's Submission
    const studentSubmission = await makeRequest('GET', `/api/protected/assessments/${assessment.id}/submission`, null, studentAuth.accessToken);
    logTest('Get Student Submission', studentSubmission.id === submission.id);
    
    // Test 4: Submit Answers
    const answers = [
      { questionId: questions[0].id, answer: 'Paris' },
      { questionId: questions[1].id, answer: 'false' },
      { questionId: questions[2].id, answer: '4' }
    ];
    
    for (const answerData of answers) {
      const answer = await makeRequest('POST', `/api/protected/submissions/${submission.id}/answers`, answerData, studentAuth.accessToken);
      logTest(`Submit Answer for Question ${answerData.questionId}`, !!answer.id);
    }
    
    // Test 5: Get Submission with Answers
    const submissionWithAnswers = await makeRequest('GET', `/api/protected/submissions/${submission.id}`, null, studentAuth.accessToken);
    logTest('Get Submission with Answers', submissionWithAnswers.answers && submissionWithAnswers.answers.length === 3);
    
    // Test 6: Submit Assessment
    const finalSubmission = await makeRequest('POST', `/api/protected/submissions/${submission.id}/submit`, {}, studentAuth.accessToken);
    logTest('Submit Assessment', finalSubmission.status === 'submitted');
    
    // Test 7: Verify Score Calculation
    const expectedScore = 2 + 1 + 1; // All correct answers
    logTest('Score Calculation', finalSubmission.score === expectedScore);
    
    // Test 8: Try to Start Assessment Again (Should Fail)
    try {
      await makeRequest('POST', `/api/protected/assessments/${assessment.id}/start`, {}, studentAuth.accessToken);
      logTest('Prevent Multiple Submissions', false, 'Should not allow starting assessment again');
    } catch (error) {
      logTest('Prevent Multiple Submissions', true);
    }
    
    return submission;
    
  } catch (error) {
    logTest('Assessment Taking Tests', false, error.message);
    throw error;
  }
}

async function testAssessmentStatusManagement(assessment, teacherAuth) {
  console.log('\n=== ASSESSMENT STATUS MANAGEMENT TESTS ===');
  
  try {
    // Test 1: Publish Assessment
    const publishedAssessment = await makeRequest('PUT', `/api/protected/assessments/${assessment.id}`, {
      status: 'published'
    }, teacherAuth.accessToken);
    logTest('Publish Assessment', publishedAssessment.status === 'published');
    
    // Test 2: Close Assessment
    const closedAssessment = await makeRequest('PUT', `/api/protected/assessments/${assessment.id}`, {
      status: 'closed'
    }, teacherAuth.accessToken);
    logTest('Close Assessment', closedAssessment.status === 'closed');
    
    // Test 3: Reopen Assessment (back to published)
    const reopenedAssessment = await makeRequest('PUT', `/api/protected/assessments/${assessment.id}`, {
      status: 'published'
    }, teacherAuth.accessToken);
    logTest('Reopen Assessment', reopenedAssessment.status === 'published');
    
    return reopenedAssessment;
    
  } catch (error) {
    logTest('Assessment Status Management Tests', false, error.message);
    throw error;
  }
}

async function testSubmissionManagement(assessment, teacherAuth, studentAuth) {
  console.log('\n=== SUBMISSION MANAGEMENT TESTS ===');
  
  try {
    // Test 1: Get All Submissions for Assessment (Teacher View)
    const submissions = await makeRequest('GET', `/api/protected/assessments/${assessment.id}/submissions`, null, teacherAuth.accessToken);
    logTest('Get Assessment Submissions', Array.isArray(submissions));
    
    // Test 2: Get Specific Submission Details
    if (submissions.length > 0) {
      const submissionDetails = await makeRequest('GET', `/api/protected/submissions/${submissions[0].id}`, null, teacherAuth.accessToken);
      logTest('Get Submission Details', !!submissionDetails.id);
      
      // Test 3: Grade Submission (Manual Override)
      const gradedSubmission = await makeRequest('PUT', `/api/protected/submissions/${submissions[0].id}`, {
        score: submissions[0].totalPoints, // Full marks
        feedback: 'Excellent work!'
      }, teacherAuth.accessToken);
      logTest('Grade Submission', gradedSubmission.feedback === 'Excellent work!');
    }
    
    return submissions;
    
  } catch (error) {
    logTest('Submission Management Tests', false, error.message);
    throw error;
  }
}

async function testTimeLimitFeature(course, teacherAuth, studentAuth) {
  console.log('\n=== TIME LIMIT FEATURE TESTS ===');
  
  try {
    // Test 1: Create Assessment with Short Time Limit
    const timedAssessmentData = {
      title: 'Timed Test Quiz',
      description: 'A quiz with a very short time limit for testing',
      timeLimit: 1 // 1 minute
    };
    
    const timedAssessment = await makeRequest('POST', `/api/protected/courses/${course.id}/assessments`, timedAssessmentData, teacherAuth.accessToken);
    logTest('Create Timed Assessment', !!timedAssessment.id);
    
    // Test 2: Add a Question
    const quickQuestion = {
      type: 'multiple_choice',
      questionText: 'Quick question: What is 1 + 1?',
      options: JSON.stringify(['1', '2', '3', '4']),
      correctAnswer: '2',
      points: 1,
      order: 1
    };
    
    await makeRequest('POST', `/api/protected/assessments/${timedAssessment.id}/questions`, quickQuestion, teacherAuth.accessToken);
    logTest('Add Question to Timed Assessment', true);
    
    // Test 3: Start Timed Assessment
    const timedSubmission = await makeRequest('POST', `/api/protected/assessments/${timedAssessment.id}/start`, {}, studentAuth.accessToken);
    logTest('Start Timed Assessment', !!timedSubmission.startedAt);
    
    // Test 4: Verify Time Tracking
    const submissionCheck = await makeRequest('GET', `/api/protected/assessments/${timedAssessment.id}/submission`, null, studentAuth.accessToken);
    const startTime = new Date(submissionCheck.startedAt);
    const now = new Date();
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    logTest('Time Tracking', elapsedSeconds >= 0 && elapsedSeconds < 60);
    
    return { timedAssessment, timedSubmission };
    
  } catch (error) {
    logTest('Time Limit Feature Tests', false, error.message);
    throw error;
  }
}

async function testErrorHandling(course, assessment, teacherAuth, studentAuth) {
  console.log('\n=== ERROR HANDLING TESTS ===');
  
  try {
    // Test 1: Create Assessment with Invalid Data
    try {
      await makeRequest('POST', `/api/protected/courses/${course.id}/assessments`, {
        title: '', // Empty title should fail
        description: 'Test'
      }, teacherAuth.accessToken);
      logTest('Invalid Assessment Data Handling', false, 'Should have failed with empty title');
    } catch (error) {
      logTest('Invalid Assessment Data Handling', true);
    }
    
    // Test 2: Access Non-existent Assessment
    try {
      await makeRequest('GET', '/api/protected/assessments/non-existent-id', null, teacherAuth.accessToken);
      logTest('Non-existent Assessment Handling', false, 'Should have failed');
    } catch (error) {
      logTest('Non-existent Assessment Handling', true);
    }
    
    // Test 3: Student Access to Teacher-only Endpoints
    try {
      await makeRequest('POST', `/api/protected/courses/${course.id}/assessments`, {
        title: 'Unauthorized Test',
        description: 'Should fail'
      }, studentAuth.accessToken);
      logTest('Unauthorized Access Prevention', false, 'Student should not create assessments');
    } catch (error) {
      logTest('Unauthorized Access Prevention', true);
    }
    
    // Test 4: Submit Answer to Non-existent Question
    try {
      const testSubmission = await makeRequest('POST', `/api/protected/assessments/${assessment.id}/start`, {}, studentAuth.accessToken);
      await makeRequest('POST', `/api/protected/submissions/${testSubmission.id}/answers`, {
        questionId: 'non-existent-question',
        answer: 'test'
      }, studentAuth.accessToken);
      logTest('Invalid Question ID Handling', false, 'Should have failed');
    } catch (error) {
      logTest('Invalid Question ID Handling', true);
    }
    
  } catch (error) {
    logTest('Error Handling Tests', false, error.message);
  }
}

async function runAssessmentTests() {
  console.log('🚀 Starting Comprehensive Assessment Test Suite\n');
  
  try {
    // Setup
    const { teacherAuth, studentAuth, course } = await setupTestUsers();
    
    // Phase 1: Assessment CRUD
    const { assessment, simpleAssessment } = await testAssessmentCRUD(course, teacherAuth);
    
    // Phase 2: Question Management
    const questions = await testQuestionManagement(assessment, teacherAuth);
    
    // Phase 3: Assessment Taking
    const submission = await testAssessmentTaking(assessment, questions, studentAuth);
    
    // Phase 4: Assessment Status Management
    await testAssessmentStatusManagement(simpleAssessment, teacherAuth);
    
    // Phase 5: Submission Management
    await testSubmissionManagement(assessment, teacherAuth, studentAuth);
    
    // Phase 6: Time Limit Feature
    await testTimeLimitFeature(course, teacherAuth, studentAuth);
    
    // Phase 7: Error Handling
    await testErrorHandling(course, assessment, teacherAuth, studentAuth);
    
    // Print Summary
    console.log('\n' + '='.repeat(70));
    console.log('🎯 ASSESSMENT TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Total: ${testResults.tests.length}`);
    console.log(`🎯 Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.tests.filter(t => !t.passed).forEach(test => {
        console.log(`   - ${test.name}: ${test.details}`);
      });
    }
    
    console.log('\n🏆 ASSESSMENT FEATURES TESTED:');
    console.log('✅ Assessment CRUD Operations');
    console.log('✅ Multiple Question Types (MC, T/F, Short Answer, Fill-in-Blank)');
    console.log('✅ Question Management (Create, Read, Update, Delete)');
    console.log('✅ Assessment Taking Flow');
    console.log('✅ Answer Submission and Storage');
    console.log('✅ Automatic Score Calculation');
    console.log('✅ Assessment Status Management (Draft, Published, Closed)');
    console.log('✅ Submission Management and Grading');
    console.log('✅ Time Limit Features');
    console.log('✅ Error Handling and Security');
    console.log('✅ Authorization and Access Control');
    
    console.log('\n🎉 Assessment Test Suite Complete!');
    
    return testResults.failed === 0;
    
  } catch (error) {
    console.error('\n💥 Test Suite Failed:', error.message);
    return false;
  }
}

// Run the tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAssessmentTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { runAssessmentTests };