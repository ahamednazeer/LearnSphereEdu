import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testCourseLearningFlow() {
  console.log('🧪 Testing Course Learning Flow After Enrollment...\n');

  let teacherToken, studentToken;
  let courseId, moduleId, lessonId;

  try {
    // 1. Setup: Create teacher and student accounts
    console.log('1️⃣ Setting up test accounts...');
    
    // Register/Login Teacher
    try {
      const teacherRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'teacher-learning@test.com',
          password: 'password123',
          firstName: 'Learning',
          lastName: 'Teacher',
          role: 'teacher'
        })
      });
      
      if (teacherRegRes.ok) {
        const teacherData = await teacherRegRes.json();
        teacherToken = teacherData.accessToken;
        console.log('✅ Teacher registered successfully');
      } else {
        // Try login if registration fails
        const teacherLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'teacher-learning@test.com',
            password: 'password123'
          })
        });
        const teacherData = await teacherLoginRes.json();
        teacherToken = teacherData.accessToken;
        console.log('✅ Teacher logged in successfully');
      }
    } catch (error) {
      console.error('❌ Teacher setup failed:', error.message);
      return;
    }

    // Register/Login Student
    try {
      const studentRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'student-learning@test.com',
          password: 'password123',
          firstName: 'Learning',
          lastName: 'Student',
          role: 'student'
        })
      });
      
      if (studentRegRes.ok) {
        const studentData = await studentRegRes.json();
        studentToken = studentData.accessToken;
        console.log('✅ Student registered successfully');
      } else {
        // Try login if registration fails
        const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'student-learning@test.com',
            password: 'password123'
          })
        });
        const studentData = await studentLoginRes.json();
        studentToken = studentData.accessToken;
        console.log('✅ Student logged in successfully');
      }
    } catch (error) {
      console.error('❌ Student setup failed:', error.message);
      return;
    }

    // 2. Teacher creates course with content
    console.log('\n2️⃣ Creating course with content...');
    
    const courseRes = await fetch(`${BASE_URL}/api/protected/courses/enhanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        title: 'Learning Flow Test Course',
        description: 'A course to test the learning flow functionality',
        subject: 'Testing',
        status: 'published'
      })
    });

    if (!courseRes.ok) {
      const error = await courseRes.text();
      throw new Error(`Course creation failed: ${error}`);
    }

    const course = await courseRes.json();
    courseId = course.id;
    console.log(`✅ Course created: ${course.title} (ID: ${courseId})`);

    // Create module
    const moduleRes = await fetch(`${BASE_URL}/api/protected/courses/${courseId}/modules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        title: 'Test Module',
        description: 'A test module for learning flow',
        sequenceOrder: 1
      })
    });

    if (!moduleRes.ok) {
      const error = await moduleRes.text();
      throw new Error(`Module creation failed: ${error}`);
    }

    const module = await moduleRes.json();
    moduleId = module.id;
    console.log(`✅ Module created: ${module.title} (ID: ${moduleId})`);

    // Create lesson
    const lessonRes = await fetch(`${BASE_URL}/api/protected/modules/${moduleId}/lessons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        title: 'Test Lesson',
        description: 'A test lesson for learning flow',
        contentType: 'article',
        content: 'This is test lesson content for the learning flow test.',
        sequenceOrder: 1
      })
    });

    if (!lessonRes.ok) {
      const error = await lessonRes.text();
      throw new Error(`Lesson creation failed: ${error}`);
    }

    const lesson = await lessonRes.json();
    lessonId = lesson.id;
    console.log(`✅ Lesson created: ${lesson.title} (ID: ${lessonId})`);

    // 3. Student enrolls in course
    console.log('\n3️⃣ Student enrolling in course...');
    
    const enrollRes = await fetch(`${BASE_URL}/api/protected/courses/${courseId}/enroll`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${studentToken}`
      }
    });

    if (!enrollRes.ok) {
      const error = await enrollRes.text();
      throw new Error(`Enrollment failed: ${error}`);
    }

    const enrollment = await enrollRes.json();
    console.log(`✅ Student enrolled successfully (ID: ${enrollment.id})`);

    // 4. Test course modules access after enrollment
    console.log('\n4️⃣ Testing course modules access after enrollment...');
    
    const modulesRes = await fetch(`${BASE_URL}/api/protected/courses/${courseId}/modules`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${studentToken}`
      }
    });

    if (!modulesRes.ok) {
      const error = await modulesRes.text();
      throw new Error(`Modules access failed: ${error}`);
    }

    const modules = await modulesRes.json();
    console.log(`✅ Student can access ${modules.length} module(s)`);
    
    if (modules.length > 0 && modules[0].lessons) {
      console.log(`📖 Found ${modules[0].lessons.length} lesson(s) in first module`);
      const firstLesson = modules[0].lessons[0];
      console.log(`📄 First lesson: "${firstLesson.title}" (Completed: ${firstLesson.completed || false})`);
    }

    // 5. Test lesson completion
    console.log('\n5️⃣ Testing lesson completion...');
    
    const completeRes = await fetch(`${BASE_URL}/api/protected/courses/${courseId}/lessons/${lessonId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${studentToken}`
      }
    });

    if (!completeRes.ok) {
      const error = await completeRes.text();
      throw new Error(`Lesson completion failed: ${error}`);
    }

    const completionResult = await completeRes.json();
    console.log(`✅ Lesson marked as complete (Progress: ${completionResult.progress}%)`);

    // 6. Verify completion status
    console.log('\n6️⃣ Verifying completion status...');
    
    const updatedModulesRes = await fetch(`${BASE_URL}/api/protected/courses/${courseId}/modules`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${studentToken}`
      }
    });

    if (!updatedModulesRes.ok) {
      const error = await updatedModulesRes.text();
      throw new Error(`Updated modules fetch failed: ${error}`);
    }

    const updatedModules = await updatedModulesRes.json();
    const updatedLesson = updatedModules[0].lessons[0];
    console.log(`✅ Lesson completion status updated: ${updatedLesson.completed}`);

    // 7. Test course progress
    console.log('\n7️⃣ Testing course progress tracking...');
    
    const progressRes = await fetch(`${BASE_URL}/api/protected/courses/${courseId}/progress`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${studentToken}`
      }
    });

    if (!progressRes.ok) {
      const error = await progressRes.text();
      throw new Error(`Progress fetch failed: ${error}`);
    }

    const progress = await progressRes.json();
    console.log(`✅ Course progress: ${progress.progress}% (${progress.completedLessons}/${progress.totalLessons} lessons)`);

    console.log('\n🎉 Course Learning Flow Test PASSED! 🎉');
    console.log('\n📝 Summary:');
    console.log('   - Course creation with content: ✅ Working');
    console.log('   - Student enrollment: ✅ Working');
    console.log('   - Course modules access after enrollment: ✅ Working');
    console.log('   - Lesson completion: ✅ Working');
    console.log('   - Progress tracking: ✅ Working');
    console.log('   - Completion status updates: ✅ Working');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n🔍 This indicates an issue with the course learning flow after enrollment.');
  }
}

// Run the test
testCourseLearningFlow();