#!/usr/bin/env node

const API_BASE = "http://localhost:5000";

async function makeRequest(method, endpoint, data = null, token = null) {
  const headers = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  return response;
}

async function testContentIssue() {
  console.log("🧪 Testing Student Content Access Issue");
  
  try {
    // Login as student
    console.log("🔐 Logging in as student...");
    const loginRes = await makeRequest("POST", "/api/auth/login", {
      email: "student@test.com",
      password: "password123"
    });
    
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log(`✅ Logged in as: ${loginData.user.firstName} ${loginData.user.lastName}`);
    
    // Fetch enrollments
    console.log("📚 Fetching student enrollments...");
    const enrollmentsRes = await makeRequest("GET", "/api/protected/enrollments", null, token);
    
    if (!enrollmentsRes.ok) {
      throw new Error(`Enrollments fetch failed: ${enrollmentsRes.status}`);
    }
    
    const enrollments = await enrollmentsRes.json();
    console.log(`✅ Found ${enrollments.length} enrollments`);
    
    if (enrollments.length === 0) {
      console.log("❌ No enrollments found. Student needs to be enrolled in courses first.");
      return;
    }
    
    // Test each enrollment
    for (let i = 0; i < enrollments.length; i++) {
      const enrollment = enrollments[i];
      console.log(`\n📖 Testing Course ${i + 1}: ${enrollment.title}`);
      
      // Fetch course modules and lessons
      console.log("   📋 Fetching course modules...");
      const modulesRes = await makeRequest("GET", `/api/protected/courses/${enrollment.id}/modules`, null, token);
      
      if (!modulesRes.ok) {
        console.log(`   ❌ Failed to fetch modules: ${modulesRes.status}`);
        const errorText = await modulesRes.text();
        console.log(`   Error: ${errorText}`);
        continue;
      }
      
      const modules = await modulesRes.json();
      console.log(`   ✅ Found ${modules.length} modules`);
      
      // Analyze content in each module
      modules.forEach((module, moduleIdx) => {
        console.log(`   📂 Module ${moduleIdx + 1}: ${module.title}`);
        console.log(`      Lessons: ${module.lessons?.length || 0}`);
        
        if (module.lessons && module.lessons.length > 0) {
          module.lessons.forEach((lesson, lessonIdx) => {
            console.log(`      📄 Lesson ${lessonIdx + 1}: ${lesson.title}`);
            console.log(`         Content Type: ${lesson.contentType || 'none'}`);
            console.log(`         Has URL: ${!!lesson.url}`);
            console.log(`         Has Content URL: ${!!lesson.contentUrl}`);
            console.log(`         URL: ${lesson.url || 'none'}`);
            console.log(`         Content URL: ${lesson.contentUrl || 'none'}`);
            
            // Check if this lesson would show content
            const hasValidContent = lesson.contentType && lesson.url && 
              ["video", "pdf", "article", "quiz", "file"].includes(lesson.contentType);
            console.log(`         Would Show Content: ${hasValidContent ? '✅' : '❌'}`);
            
            if (!hasValidContent) {
              console.log(`         🔍 Issue: ${!lesson.contentType ? 'No content type' : !lesson.url ? 'No URL' : 'Unsupported content type'}`);
            }
          });
        } else {
          console.log(`      ❌ No lessons found in this module`);
        }
      });
    }
    
    console.log("\n🎉 Content analysis completed!");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testContentIssue();