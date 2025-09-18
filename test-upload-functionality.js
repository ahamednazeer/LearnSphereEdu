#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_FILES_DIR = path.join(__dirname, 'test-files');

// Create test files directory if it doesn't exist
if (!fs.existsSync(TEST_FILES_DIR)) {
  fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
}

// Helper function to make HTTP requests
async function makeRequest(method, url, data = null, token = null, isFormData = false) {
  const fetch = (await import('node-fetch')).default;
  
  const options = {
    method,
    headers: {}
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data && !isFormData) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  } else if (data && isFormData) {
    options.body = data;
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  } else {
    const text = await response.text();
    console.log(`Warning: Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}...`);
    throw new Error(`Expected JSON response but got ${contentType}`);
  }
}

// Helper function to create test files
function createTestFiles() {
  console.log('📁 Creating test files...');
  
  // Create a simple text file
  const textContent = 'This is a test text file for lesson content. It contains some educational material about programming concepts.';
  fs.writeFileSync(path.join(TEST_FILES_DIR, 'test-lesson.txt'), textContent);
  
  // Create a simple HTML file
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Lesson</title>
</head>
<body>
    <h1>Test Lesson Content</h1>
    <p>This is a test HTML lesson file.</p>
    <ul>
        <li>Point 1: Introduction to concepts</li>
        <li>Point 2: Practical examples</li>
        <li>Point 3: Summary and conclusion</li>
    </ul>
</body>
</html>`;
  fs.writeFileSync(path.join(TEST_FILES_DIR, 'test-lesson.html'), htmlContent);
  
  // Create a simple PDF-like file (we'll simulate it as text)
  const pdfContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF';
  fs.writeFileSync(path.join(TEST_FILES_DIR, 'test-lesson.pdf'), pdfContent);
  
  console.log('✅ Test files created successfully');
}

// Helper function to log test results
function logTest(testName, success, details = '') {
  const status = success ? '✅' : '❌';
  console.log(`${status} ${testName}${details ? ': ' + details : ''}`);
}

async function runUploadTests() {
  console.log('🚀 Starting Upload Functionality Tests\n');
  
  try {
    // Create test files
    createTestFiles();
    
    // Step 1: Login as teacher
    console.log('👤 Logging in as teacher...');
    const teacherAuth = await makeRequest('POST', `${BASE_URL}/api/auth/login`, {
      email: 'teacher@test.com',
      password: 'password123'
    });
    logTest('Teacher Login', !!teacherAuth.accessToken);
    
    // Step 2: Create a test course
    console.log('\n📚 Creating test course...');
    const course = await makeRequest('POST', `${BASE_URL}/api/protected/courses`, {
      title: 'Upload Test Course',
      description: 'Course for testing upload functionality',
      subject: 'Technology',
      level: 'beginner',
      price: 0,
      status: 'draft'
    }, teacherAuth.accessToken);
    logTest('Course Creation', !!course.id);
    
    // Step 3: Create a test module
    console.log('\n📖 Creating test module...');
    const module = await makeRequest('POST', `${BASE_URL}/api/protected/courses/${course.id}/modules`, {
      title: 'Upload Test Module',
      description: 'Module for testing uploads',
      orderIndex: 1
    }, teacherAuth.accessToken);
    logTest('Module Creation', !!module.id);
    
    // Step 4: Create test lessons
    console.log('\n📝 Creating test lessons...');
    const textLesson = await makeRequest('POST', `${BASE_URL}/api/protected/modules/${module.id}/lessons`, {
      title: 'Text Lesson',
      description: 'Lesson for text upload test',
      orderIndex: 1,
      contentType: 'text'
    }, teacherAuth.accessToken);
    logTest('Text Lesson Creation', !!textLesson.id);
    
    const videoLesson = await makeRequest('POST', `${BASE_URL}/api/protected/modules/${module.id}/lessons`, {
      title: 'Video Lesson',
      description: 'Lesson for video upload test',
      orderIndex: 2,
      contentType: 'video'
    }, teacherAuth.accessToken);
    logTest('Video Lesson Creation', !!videoLesson.id);
    
    const pdfLesson = await makeRequest('POST', `${BASE_URL}/api/protected/modules/${module.id}/lessons`, {
      title: 'PDF Lesson',
      description: 'Lesson for PDF upload test',
      orderIndex: 3,
      contentType: 'pdf'
    }, teacherAuth.accessToken);
    logTest('PDF Lesson Creation', !!pdfLesson.id);
    
    // Step 5: Test file uploads
    console.log('\n📤 Testing file uploads...');
    
    // Test text file upload
    try {
      const textFormData = new FormData();
      textFormData.append('file', fs.createReadStream(path.join(TEST_FILES_DIR, 'test-lesson.txt')));
      
      const textUploadResult = await makeRequest('POST', `${BASE_URL}/api/protected/lessons/${textLesson.id}/upload`, textFormData, teacherAuth.accessToken, true);
      logTest('Text File Upload', !!textUploadResult.url, `URL: ${textUploadResult.url}`);
    } catch (error) {
      logTest('Text File Upload', false, error.message);
    }
    
    // Test HTML file upload
    try {
      const htmlFormData = new FormData();
      htmlFormData.append('file', fs.createReadStream(path.join(TEST_FILES_DIR, 'test-lesson.html')));
      
      const htmlUploadResult = await makeRequest('POST', `${BASE_URL}/api/protected/lessons/${videoLesson.id}/upload`, htmlFormData, teacherAuth.accessToken, true);
      logTest('HTML File Upload', !!htmlUploadResult.url, `URL: ${htmlUploadResult.url}`);
    } catch (error) {
      logTest('HTML File Upload', false, error.message);
    }
    
    // Test PDF file upload
    try {
      const pdfFormData = new FormData();
      pdfFormData.append('file', fs.createReadStream(path.join(TEST_FILES_DIR, 'test-lesson.pdf')));
      
      const pdfUploadResult = await makeRequest('POST', `${BASE_URL}/api/protected/lessons/${pdfLesson.id}/upload`, pdfFormData, teacherAuth.accessToken, true);
      logTest('PDF File Upload', !!pdfUploadResult.url, `URL: ${pdfUploadResult.url}`);
    } catch (error) {
      logTest('PDF File Upload', false, error.message);
    }
    
    // Step 6: Verify lessons have content URLs
    console.log('\n🔍 Verifying lesson content URLs...');
    
    const updatedTextLesson = await makeRequest('GET', `${BASE_URL}/api/protected/lessons/${textLesson.id}`, null, teacherAuth.accessToken);
    logTest('Text Lesson Has Content URL', !!updatedTextLesson.contentUrl, updatedTextLesson.contentUrl);
    
    const updatedVideoLesson = await makeRequest('GET', `${BASE_URL}/api/protected/lessons/${videoLesson.id}`, null, teacherAuth.accessToken);
    logTest('Video Lesson Has Content URL', !!updatedVideoLesson.contentUrl, updatedVideoLesson.contentUrl);
    
    const updatedPdfLesson = await makeRequest('GET', `${BASE_URL}/api/protected/lessons/${pdfLesson.id}`, null, teacherAuth.accessToken);
    logTest('PDF Lesson Has Content URL', !!updatedPdfLesson.contentUrl, updatedPdfLesson.contentUrl);
    
    // Step 7: Test file access
    console.log('\n🌐 Testing file access...');
    
    if (updatedTextLesson.contentUrl) {
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${BASE_URL}${updatedTextLesson.contentUrl}`);
        logTest('Text File Access', response.ok, `Status: ${response.status}`);
      } catch (error) {
        logTest('Text File Access', false, error.message);
      }
    }
    
    if (updatedVideoLesson.contentUrl) {
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${BASE_URL}${updatedVideoLesson.contentUrl}`);
        logTest('HTML File Access', response.ok, `Status: ${response.status}`);
      } catch (error) {
        logTest('HTML File Access', false, error.message);
      }
    }
    
    if (updatedPdfLesson.contentUrl) {
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${BASE_URL}${updatedPdfLesson.contentUrl}`);
        logTest('PDF File Access', response.ok, `Status: ${response.status}`);
      } catch (error) {
        logTest('PDF File Access', false, error.message);
      }
    }
    
    // Step 8: Test upload restrictions (student should not be able to upload)
    console.log('\n🔒 Testing upload restrictions...');
    
    // Login as student
    const studentAuth = await makeRequest('POST', `${BASE_URL}/api/auth/login`, {
      email: 'student@test.com',
      password: 'password123'
    });
    
    if (studentAuth.accessToken) {
      try {
        const restrictedFormData = new FormData();
        restrictedFormData.append('file', fs.createReadStream(path.join(TEST_FILES_DIR, 'test-lesson.txt')));
        
        await makeRequest('POST', `${BASE_URL}/api/protected/lessons/${textLesson.id}/upload`, restrictedFormData, studentAuth.accessToken, true);
        logTest('Student Upload Restriction', false, 'Student was able to upload (should be forbidden)');
      } catch (error) {
        logTest('Student Upload Restriction', error.message.includes('403') || error.message.includes('Forbidden'), 'Correctly blocked student upload');
      }
    }
    
    // Step 9: Test large file handling
    console.log('\n📏 Testing large file handling...');
    
    // Create a large file (simulate)
    const largeContent = 'A'.repeat(1024 * 1024); // 1MB of 'A's
    fs.writeFileSync(path.join(TEST_FILES_DIR, 'large-test.txt'), largeContent);
    
    try {
      const largeFormData = new FormData();
      largeFormData.append('file', fs.createReadStream(path.join(TEST_FILES_DIR, 'large-test.txt')));
      
      const largeUploadResult = await makeRequest('POST', `${BASE_URL}/api/protected/lessons/${textLesson.id}/upload`, largeFormData, teacherAuth.accessToken, true);
      logTest('Large File Upload (1MB)', !!largeUploadResult.url, 'Successfully uploaded 1MB file');
    } catch (error) {
      logTest('Large File Upload (1MB)', false, error.message);
    }
    
    console.log('\n🎉 Upload functionality tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  } finally {
    // Cleanup test files
    if (fs.existsSync(TEST_FILES_DIR)) {
      fs.rmSync(TEST_FILES_DIR, { recursive: true, force: true });
      console.log('🧹 Cleaned up test files');
    }
  }
}

// Run the tests
runUploadTests().catch(console.error);