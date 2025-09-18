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

async function testStudentProgress() {
  console.log("🧪 Testing Student Progress Display");
  
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
    
    // Fetch enrollments with progress
    console.log("📚 Fetching student enrollments...");
    const enrollmentsRes = await makeRequest("GET", "/api/protected/enrollments", null, token);
    
    if (!enrollmentsRes.ok) {
      throw new Error(`Enrollments fetch failed: ${enrollmentsRes.status}`);
    }
    
    const enrollments = await enrollmentsRes.json();
    console.log(`✅ Found ${enrollments.length} enrollments`);
    
    // Display progress for each enrollment
    enrollments.forEach((enrollment, index) => {
      console.log(`\n📖 Course ${index + 1}: ${enrollment.title}`);
      console.log(`   Progress: ${enrollment.progress}%`);
      console.log(`   Completed Lessons: ${enrollment.completedLessons}`);
      console.log(`   Total Lessons: ${enrollment.totalLessons}`);
      console.log(`   Enrolled At: ${new Date(enrollment.enrolledAt).toLocaleString()}`);
    });
    
    console.log("\n🎉 Student progress test completed successfully!");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testStudentProgress();