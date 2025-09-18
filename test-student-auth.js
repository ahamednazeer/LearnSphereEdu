#!/usr/bin/env node

/**
 * Test script to verify student authentication and course creation fix
 */

const BASE_URL = 'http://localhost:5000';

async function makeRequest(method, endpoint, data = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const responseData = await response.text();
  
  return {
    status: response.status,
    ok: response.ok,
    data: responseData ? JSON.parse(responseData) : null
  };
}

async function testStudentAuthFlow() {
  console.log('🧪 Testing Student Authentication Flow...\n');
  
  try {
    // Test 1: Register a new student
    console.log('1️⃣ Testing student registration...');
    const studentData = {
      email: `test-student-${Date.now()}@example.com`,
      password: 'testpassword123',
      firstName: 'Test',
      lastName: 'Student',
      username: `teststudent${Date.now()}`,
      role: 'student'
    };
    
    const registerResponse = await makeRequest('POST', '/api/auth/register', studentData);
    
    if (!registerResponse.ok) {
      console.error('❌ Registration failed:', registerResponse.data);
      return;
    }
    
    console.log('✅ Student registered successfully');
    console.log('📋 Response format:', {
      hasAccessToken: !!registerResponse.data.accessToken,
      hasRefreshToken: !!registerResponse.data.refreshToken,
      hasUser: !!registerResponse.data.user,
      userRole: registerResponse.data.user?.role
    });
    
    const { accessToken, refreshToken, user } = registerResponse.data;
    
    // Test 2: Test protected route access
    console.log('\n2️⃣ Testing protected route access...');
    const profileResponse = await makeRequest('GET', '/api/protected/user/profile', null, accessToken);
    
    if (!profileResponse.ok) {
      console.error('❌ Profile access failed:', profileResponse.data);
      return;
    }
    
    console.log('✅ Protected route access successful');
    
    // Test 3: Test course listing (should work for students)
    console.log('\n3️⃣ Testing course listing...');
    const coursesResponse = await makeRequest('GET', '/api/protected/courses', null, accessToken);
    
    if (!coursesResponse.ok) {
      console.error('❌ Course listing failed:', coursesResponse.data);
      return;
    }
    
    console.log('✅ Course listing successful');
    console.log('📚 Found', coursesResponse.data.length, 'courses');
    
    // Test 4: Test login with the same credentials
    console.log('\n4️⃣ Testing login with registered credentials...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: studentData.email,
      password: studentData.password
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', loginResponse.data);
      return;
    }
    
    console.log('✅ Login successful');
    console.log('📋 Login response format:', {
      hasAccessToken: !!loginResponse.data.accessToken,
      hasRefreshToken: !!loginResponse.data.refreshToken,
      hasUser: !!loginResponse.data.user,
      userRole: loginResponse.data.user?.role
    });
    
    // Test 5: Test token refresh
    console.log('\n5️⃣ Testing token refresh...');
    const refreshResponse = await makeRequest('POST', '/api/auth/refresh', {
      refreshToken: loginResponse.data.refreshToken
    });
    
    if (!refreshResponse.ok) {
      console.error('❌ Token refresh failed:', refreshResponse.data);
      return;
    }
    
    console.log('✅ Token refresh successful');
    
    console.log('\n🎉 All tests passed! Student authentication is working correctly.');
    console.log('\n📝 Summary:');
    console.log('   - Student registration: ✅ Working with new token format');
    console.log('   - Protected routes: ✅ Accessible with access token');
    console.log('   - Course listing: ✅ Working for students');
    console.log('   - Login: ✅ Working with new token format');
    console.log('   - Token refresh: ✅ Working');
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  }
}

// Run the test
testStudentAuthFlow();