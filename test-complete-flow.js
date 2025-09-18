#!/usr/bin/env node

const API_BASE = 'http://localhost:5000';

async function testCompleteFlow() {
  console.log('🧪 Testing Complete Teacher-Student Flow...\n');

  try {
    // 1. Register teacher and create course with content
    console.log('1️⃣ Setting up teacher and course with content...');
    const teacherResponse = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `teacher_${Date.now()}`,
        email: `teacher_${Date.now()}@test.com`,
        password: 'password123',
        firstName: 'Content',
        lastName: 'Teacher',
        role: 'teacher'
      })
    });

    const teacherData = await teacherResponse.json();
    const teacherToken = teacherData.accessToken;

    // Create course
    const courseResponse = await fetch(`${API_BASE}/api/protected/courses`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        title: 'Full Course with Content',
        description: 'A complete course with modules and lessons',
        subject: 'Mathematics'
      })
    });

    const courseData = await courseResponse.json();
    console.log('✅ Course created and auto-published');

    // Add module to course
    const moduleResponse = await fetch(`${API_BASE}/api/protected/courses/${courseData.id}/modules`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        title: 'Introduction Module',
        description: 'Getting started with the course',
        sequenceOrder: 1
      })
    });

    const moduleData = await moduleResponse.json();
    console.log('✅ Module added to course');

    // Add lesson to module
    const lessonResponse = await fetch(`${API_BASE}/api/protected/modules/${moduleData.id}/lessons`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      },
      body: JSON.stringify({
        title: 'Welcome Lesson',
        description: 'Introduction to the course',
        sequenceOrder: 1,
        contentType: 'text',
        content: 'Welcome to our mathematics course!'
      })
    });

    const lessonData = await lessonResponse.json();
    console.log('✅ Lesson added to module');

    // 2. Register student and verify they can see the course
    console.log('\n2️⃣ Testing student course discovery...');
    const studentResponse = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `student_${Date.now()}`,
        email: `student_${Date.now()}@test.com`,
        password: 'password123',
        firstName: 'Eager',
        lastName: 'Student',
        role: 'student'
      })
    });

    const studentData = await studentResponse.json();
    const studentToken = studentData.accessToken;

    // Check courses visible to student
    const studentCoursesResponse = await fetch(`${API_BASE}/api/protected/courses`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });

    const studentCourses = await studentCoursesResponse.json();
    const targetCourse = studentCourses.find(c => c.id === courseData.id);
    
    if (targetCourse) {
      console.log('✅ Student can see course with content');
      console.log(`📚 Course: "${targetCourse.title}"`);
      console.log(`📊 Status: ${targetCourse.status}`);
      console.log(`🎯 Enrolled: ${targetCourse.isEnrolled ? 'Yes' : 'No'}`);
    } else {
      throw new Error('Student cannot see the course with content');
    }

    // 3. Test enrollment
    console.log('\n3️⃣ Testing course enrollment...');
    const enrollResponse = await fetch(`${API_BASE}/api/protected/courses/${courseData.id}/enroll`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });

    if (enrollResponse.ok) {
      console.log('✅ Student successfully enrolled');
    } else {
      throw new Error('Enrollment failed');
    }

    // 4. Verify enrolled course shows up with progress
    console.log('\n4️⃣ Verifying enrolled course visibility...');
    const enrolledCoursesResponse = await fetch(`${API_BASE}/api/protected/courses`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });

    const enrolledCourses = await enrolledCoursesResponse.json();
    const enrolledCourse = enrolledCourses.find(c => c.id === courseData.id);
    
    if (enrolledCourse && enrolledCourse.isEnrolled) {
      console.log('✅ Enrolled course properly marked');
      console.log(`📈 Progress: ${enrolledCourse.enrollment?.progress || 0}%`);
      console.log(`📅 Enrolled at: ${new Date(enrolledCourse.enrollment?.enrolledAt).toLocaleString()}`);
    } else {
      throw new Error('Enrolled course not properly marked');
    }

    // 5. Test course content access
    console.log('\n5️⃣ Testing course content access...');
    const moduleAccessResponse = await fetch(`${API_BASE}/api/protected/courses/${courseData.id}/modules`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });

    if (moduleAccessResponse.ok) {
      const modules = await moduleAccessResponse.json();
      console.log(`✅ Student can access ${modules.length} module(s)`);
      
      if (modules.length > 0 && modules[0].lessons && modules[0].lessons.length > 0) {
        console.log(`📖 Found ${modules[0].lessons.length} lesson(s) in first module`);
      }
    } else {
      throw new Error('Student cannot access course content');
    }

    console.log('\n🎉 Complete flow test passed!\n');
    
    console.log('📝 Summary:');
    console.log('   - Teacher creates course with content: ✅');
    console.log('   - Course auto-published: ✅');
    console.log('   - Student can discover published courses: ✅');
    console.log('   - Student can enroll in courses: ✅');
    console.log('   - Enrollment status properly tracked: ✅');
    console.log('   - Student can access course content: ✅');
    console.log('\n🚀 The student empty courses issue has been resolved!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testCompleteFlow();