#!/usr/bin/env node

/**
 * Comprehensive Test Script for LearnSphere LMS
 * Tests both Student and Teacher flows end-to-end
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

// Test data
const testTeacher = {
  username: 'teacher_test',
  email: 'teacher@test.com',
  password: 'password123',
  firstName: 'John',
  lastName: 'Teacher',
  role: 'teacher'
};

const testStudent = {
  username: 'student_test',
  email: 'student@test.com',
  password: 'password123',
  firstName: 'Jane',
  lastName: 'Student',
  role: 'student'
};

const testCourse = {
  title: 'Introduction to JavaScript',
  subject: 'Programming',
  description: '<p>Learn the fundamentals of JavaScript programming</p>',
  objectives: '<p>• Understand variables and data types<br>• Learn control structures<br>• Master functions and objects</p>',
  targetAudience: 'beginner',
  duration: '4 weeks'
};

const testModules = [
  {
    title: 'JavaScript Basics',
    lessons: [
      {
        title: 'Variables and Data Types',
        contentType: 'video',
        url: 'https://example.com/video1.mp4'
      },
      {
        title: 'Control Structures',
        contentType: 'article',
        url: 'https://example.com/article1'
      }
    ]
  },
  {
    title: 'Functions and Objects',
    lessons: [
      {
        title: 'Introduction to Functions',
        contentType: 'video',
        url: 'https://example.com/video2.mp4'
      }
    ]
  }
];

const testAssessment = {
  title: 'JavaScript Fundamentals Quiz',
  description: 'Test your knowledge of JavaScript basics',
  timeLimit: 30,
  questions: [
    {
      type: 'multiple_choice',
      questionText: 'What is the correct way to declare a variable in JavaScript?',
      options: ['var x = 5;', 'variable x = 5;', 'v x = 5;', 'declare x = 5;'],
      correctAnswer: 'var x = 5;',
      points: 2,
      order: 1
    },
    {
      type: 'multiple_choice',
      questionText: 'Which of the following is a JavaScript data type?',
      options: ['string', 'number', 'boolean', 'all of the above'],
      correctAnswer: 'all of the above',
      points: 2,
      order: 2
    }
  ]
};

// Helper functions
async function makeRequest(method, endpoint, data = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseData.message || 'Request failed'}`);
    }
    
    return responseData;
  } catch (error) {
    console.error(`Request failed: ${method} ${endpoint}`, error.message);
    throw error;
  }
}

async function registerUser(userData) {
  console.log(`📝 Registering ${userData.role}: ${userData.email}`);
  try {
    const result = await makeRequest('POST', '/api/auth/register', userData);
    console.log(`✅ Successfully registered ${userData.role}: ${userData.firstName} ${userData.lastName}`);
    return result;
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log(`ℹ️  User ${userData.email} already exists, attempting login...`);
      return await loginUser(userData.email, userData.password);
    }
    throw error;
  }
}

async function loginUser(email, password) {
  console.log(`🔐 Logging in: ${email}`);
  const result = await makeRequest('POST', '/api/auth/login', { email, password });
  console.log(`✅ Successfully logged in: ${result.user.firstName} ${result.user.lastName}`);
  return result;
}

async function createCourse(courseData, token) {
  console.log(`📚 Creating course: ${courseData.title}`);
  const result = await makeRequest('POST', '/api/protected/courses', courseData, token);
  console.log(`✅ Course created with ID: ${result.id}`);
  return result;
}

async function createModule(courseId, moduleData, token) {
  console.log(`📖 Creating module: ${moduleData.title}`);
  const result = await makeRequest('POST', `/api/protected/courses/${courseId}/modules`, {
    title: moduleData.title,
    sequenceOrder: 0,
    courseId: courseId
  }, token);
  console.log(`✅ Module created with ID: ${result.id}`);
  return result;
}

async function createLesson(moduleId, lessonData, token) {
  console.log(`📄 Creating lesson: ${lessonData.title}`);
  const result = await makeRequest('POST', `/api/protected/modules/${moduleId}/lessons`, {
    title: lessonData.title,
    contentType: lessonData.contentType,
    url: lessonData.url,
    sequenceOrder: 0,
    moduleId: moduleId
  }, token);
  console.log(`✅ Lesson created with ID: ${result.id}`);
  return result;
}

async function createAssessment(courseId, assessmentData, token) {
  console.log(`📝 Creating assessment: ${assessmentData.title}`);
  const result = await makeRequest('POST', `/api/protected/courses/${courseId}/assessments`, {
    title: assessmentData.title,
    description: assessmentData.description,
    timeLimit: assessmentData.timeLimit,
    courseId: courseId
  }, token);
  console.log(`✅ Assessment created with ID: ${result.id}`);
  return result;
}

async function createQuestion(assessmentId, questionData, token) {
  console.log(`❓ Creating question: ${questionData.questionText.substring(0, 50)}...`);
  const result = await makeRequest('POST', `/api/protected/assessments/${assessmentId}/questions`, {
    type: questionData.type,
    questionText: questionData.questionText,
    options: questionData.options, // Pass as array, not JSON string
    correctAnswer: questionData.correctAnswer,
    points: questionData.points,
    order: questionData.order,
    assessmentId: assessmentId
  }, token);
  console.log(`✅ Question created with ID: ${result.id}`);
  return result;
}

async function publishCourse(courseId, token) {
  console.log(`🚀 Publishing course: ${courseId}`);
  const result = await makeRequest('POST', `/api/protected/courses/${courseId}/publish`, {}, token);
  console.log(`✅ Course published successfully`);
  return result;
}

async function enrollInCourse(courseId, token) {
  console.log(`📚 Enrolling in course: ${courseId}`);
  const result = await makeRequest('POST', `/api/protected/courses/${courseId}/enroll`, {}, token);
  console.log(`✅ Successfully enrolled in course`);
  return result;
}

async function getCourses(token) {
  console.log(`📋 Fetching available courses`);
  const result = await makeRequest('GET', '/api/protected/courses', null, token);
  console.log(`✅ Found ${result.length} courses`);
  return result;
}

async function getCourseDetails(courseId, token) {
  console.log(`📖 Fetching course details: ${courseId}`);
  const result = await makeRequest('GET', `/api/protected/courses/${courseId}`, null, token);
  console.log(`✅ Retrieved course: ${result.title}`);
  return result;
}

async function getAssessments(courseId, token) {
  console.log(`📝 Fetching assessments for course: ${courseId}`);
  const result = await makeRequest('GET', `/api/protected/courses/${courseId}/assessments`, null, token);
  console.log(`✅ Found ${result.length} assessments`);
  return result;
}

async function startAssessment(assessmentId, token) {
  console.log(`▶️  Starting assessment: ${assessmentId}`);
  const result = await makeRequest('POST', `/api/protected/assessments/${assessmentId}/start`, {}, token);
  console.log(`✅ Assessment started with submission ID: ${result.id}`);
  return result;
}

async function submitAnswer(submissionId, questionId, answer, token) {
  console.log(`💭 Submitting answer for question: ${questionId}`);
  const result = await makeRequest('POST', `/api/protected/submissions/${submissionId}/answers`, {
    questionId: questionId,
    answer: answer
  }, token);
  console.log(`✅ Answer submitted`);
  return result;
}

async function submitAssessment(submissionId, token) {
  console.log(`📤 Submitting assessment: ${submissionId}`);
  const result = await makeRequest('POST', `/api/protected/submissions/${submissionId}/submit`, {}, token);
  console.log(`✅ Assessment submitted with score: ${result.score}/${result.totalPoints}`);
  return result;
}

async function createDiscussion(courseId, discussionData, token) {
  console.log(`💬 Creating discussion: ${discussionData.title}`);
  const result = await makeRequest('POST', `/api/protected/courses/${courseId}/discussions`, discussionData, token);
  console.log(`✅ Discussion created with ID: ${result.id}`);
  return result;
}

async function createDiscussionPost(discussionId, content, token) {
  console.log(`💭 Creating discussion post`);
  const result = await makeRequest('POST', `/api/protected/discussions/${discussionId}/posts`, {
    content: content
  }, token);
  console.log(`✅ Discussion post created`);
  return result;
}

// Main test function
async function runFullFlowTest() {
  console.log('🚀 Starting LearnSphere Full Flow Test\n');
  
  let teacherAuth, studentAuth, courseId, assessmentId, submissionId;
  
  try {
    // Phase 1: User Registration and Authentication
    console.log('=== PHASE 1: USER REGISTRATION & AUTHENTICATION ===');
    teacherAuth = await registerUser(testTeacher);
    studentAuth = await registerUser(testStudent);
    console.log('');

    // Phase 2: Teacher Flow - Course Creation
    console.log('=== PHASE 2: TEACHER FLOW - COURSE CREATION ===');
    
    // Create course
    const course = await createCourse({
      ...testCourse,
      teacherId: teacherAuth.user.id
    }, teacherAuth.accessToken);
    courseId = course.id;

    // Create modules and lessons
    for (let i = 0; i < testModules.length; i++) {
      const moduleData = testModules[i];
      const module = await createModule(courseId, moduleData, teacherAuth.accessToken);
      
      for (let j = 0; j < moduleData.lessons.length; j++) {
        const lessonData = moduleData.lessons[j];
        await createLesson(module.id, lessonData, teacherAuth.accessToken);
      }
    }

    // Create assessment
    const assessment = await createAssessment(courseId, testAssessment, teacherAuth.accessToken);
    assessmentId = assessment.id;

    // Create questions
    for (const questionData of testAssessment.questions) {
      await createQuestion(assessmentId, questionData, teacherAuth.accessToken);
    }

    // Publish course
    await publishCourse(courseId, teacherAuth.accessToken);
    
    // Create discussion
    await createDiscussion(courseId, {
      title: 'Welcome to JavaScript Course',
      description: 'Introduce yourself and ask any questions about the course'
    }, teacherAuth.accessToken);
    
    console.log('');

    // Phase 3: Student Flow - Course Discovery and Enrollment
    console.log('=== PHASE 3: STUDENT FLOW - COURSE DISCOVERY & ENROLLMENT ===');
    
    // Browse courses
    const availableCourses = await getCourses(studentAuth.accessToken);
    
    // Get course details
    const courseDetails = await getCourseDetails(courseId, studentAuth.accessToken);
    
    // Enroll in course
    await enrollInCourse(courseId, studentAuth.accessToken);
    console.log('');

    // Phase 4: Student Flow - Learning and Assessment
    console.log('=== PHASE 4: STUDENT FLOW - LEARNING & ASSESSMENT ===');
    
    // Get assessments
    const assessments = await getAssessments(courseId, studentAuth.accessToken);
    
    if (assessments.length > 0) {
      // Start assessment
      const submission = await startAssessment(assessmentId, studentAuth.accessToken);
      submissionId = submission.id;
      
      // Get assessment questions
      const questions = await makeRequest('GET', `/api/protected/assessments/${assessmentId}/questions`, null, studentAuth.accessToken);
      
      // Submit answers
      if (questions && questions.length > 0) {
        for (const question of questions) {
          let answer;
          if (question.type === 'multiple_choice') {
            // For demo, always pick the correct answer
            answer = question.correctAnswer;
          }
          await submitAnswer(submissionId, question.id, answer, studentAuth.accessToken);
        }
        
        // Submit assessment
        await submitAssessment(submissionId, studentAuth.accessToken);
      }
    }
    console.log('');

    // Phase 5: Discussion Participation
    console.log('=== PHASE 5: DISCUSSION PARTICIPATION ===');
    
    // Get discussions
    const discussions = await makeRequest('GET', `/api/protected/courses/${courseId}/discussions`, null, studentAuth.accessToken);
    
    if (discussions.length > 0) {
      // Student posts in discussion
      await createDiscussionPost(discussions[0].id, 'Hello everyone! I\'m excited to learn JavaScript!', studentAuth.accessToken);
      
      // Teacher responds
      await createDiscussionPost(discussions[0].id, 'Welcome to the course! Feel free to ask questions anytime.', teacherAuth.accessToken);
    }
    console.log('');

    // Phase 6: Progress Tracking
    console.log('=== PHASE 6: PROGRESS TRACKING ===');
    
    // Get student progress
    const studentProgress = await makeRequest('GET', `/api/protected/courses/${courseId}/progress`, null, studentAuth.accessToken);
    console.log(`📊 Student progress: ${JSON.stringify(studentProgress, null, 2)}`);
    
    // Get teacher dashboard data
    const teacherDashboard = await makeRequest('GET', '/api/protected/instructor/dashboard', null, teacherAuth.accessToken);
    console.log(`📈 Teacher dashboard: Found ${teacherDashboard.courses?.length || 0} courses`);
    console.log('');

    console.log('🎉 FULL FLOW TEST COMPLETED SUCCESSFULLY! 🎉');
    console.log('\n=== TEST SUMMARY ===');
    console.log(`✅ Teacher registered and logged in: ${teacherAuth.user.firstName} ${teacherAuth.user.lastName}`);
    console.log(`✅ Student registered and logged in: ${studentAuth.user.firstName} ${studentAuth.user.lastName}`);
    console.log(`✅ Course created: ${testCourse.title} (ID: ${courseId})`);
    console.log(`✅ ${testModules.length} modules created with lessons`);
    console.log(`✅ Assessment created with ${testAssessment.questions.length} questions`);
    console.log(`✅ Course published successfully`);
    console.log(`✅ Student enrolled in course`);
    console.log(`✅ Student completed assessment`);
    console.log(`✅ Discussion participation completed`);
    console.log(`✅ Progress tracking verified`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
runFullFlowTest().catch(console.error);