#!/bin/bash

# Assessment Test Script using curl
# Tests all assessment functionality via API calls

API_BASE="http://localhost:5000"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Function to log test results
log_test() {
    local name="$1"
    local result="$2"
    local details="$3"
    
    if [ "$result" = "true" ]; then
        echo -e "${GREEN}✅ $name${NC}${details:+: $details}"
        ((PASSED++))
    else
        echo -e "${RED}❌ $name${NC}${details:+: $details}"
        ((FAILED++))
    fi
}

# Function to make API requests
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local token="$4"
    
    local curl_opts="-s -X $method"
    
    if [ -n "$token" ]; then
        curl_opts="$curl_opts -H 'Authorization: Bearer $token'"
    fi
    
    if [ -n "$data" ]; then
        curl_opts="$curl_opts -H 'Content-Type: application/json' -d '$data'"
    fi
    
    eval "curl $curl_opts '$API_BASE$endpoint'"
}

echo -e "${BLUE}🚀 Assessment API Test Suite${NC}\n"

# Generate unique identifiers
TIMESTAMP=$(date +%s)
TEACHER_EMAIL="teacher_test_${TIMESTAMP}@test.com"
STUDENT_EMAIL="student_test_${TIMESTAMP}@test.com"

echo -e "${BLUE}📋 Setting up test users...${NC}"

# Create teacher account
TEACHER_DATA="{\"username\":\"teacher_$TIMESTAMP\",\"email\":\"$TEACHER_EMAIL\",\"password\":\"password123\",\"firstName\":\"Test\",\"lastName\":\"Teacher\",\"role\":\"teacher\"}"
TEACHER_RESPONSE=$(make_request "POST" "/api/auth/register" "$TEACHER_DATA")
TEACHER_TOKEN=$(echo "$TEACHER_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -n "$TEACHER_TOKEN" ]; then
    log_test "Teacher Registration" "true"
else
    log_test "Teacher Registration" "false" "No access token received"
    exit 1
fi

# Create student account
STUDENT_DATA="{\"username\":\"student_$TIMESTAMP\",\"email\":\"$STUDENT_EMAIL\",\"password\":\"password123\",\"firstName\":\"Test\",\"lastName\":\"Student\",\"role\":\"student\"}"
STUDENT_RESPONSE=$(make_request "POST" "/api/auth/register" "$STUDENT_DATA")
STUDENT_TOKEN=$(echo "$STUDENT_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -n "$STUDENT_TOKEN" ]; then
    log_test "Student Registration" "true"
else
    log_test "Student Registration" "false" "No access token received"
    exit 1
fi

# Create course
COURSE_DATA="{\"title\":\"Test Course $TIMESTAMP\",\"description\":\"Course for testing assessments\",\"subject\":\"Testing\"}"
COURSE_RESPONSE=$(make_request "POST" "/api/protected/courses" "$COURSE_DATA" "$TEACHER_TOKEN")
COURSE_ID=$(echo "$COURSE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$COURSE_ID" ]; then
    log_test "Course Creation" "true"
else
    log_test "Course Creation" "false" "No course ID received"
    exit 1
fi

# Enroll student
ENROLL_RESPONSE=$(make_request "POST" "/api/protected/courses/$COURSE_ID/enroll" "{}" "$STUDENT_TOKEN")
if echo "$ENROLL_RESPONSE" | grep -q '"id"'; then
    log_test "Student Enrollment" "true"
else
    log_test "Student Enrollment" "false"
fi

echo -e "\n${BLUE}🎯 Testing Assessment CRUD...${NC}"

# Create assessment
ASSESSMENT_DATA="{\"title\":\"Test Quiz $TIMESTAMP\",\"description\":\"A comprehensive test assessment\",\"timeLimit\":30}"
ASSESSMENT_RESPONSE=$(make_request "POST" "/api/protected/courses/$COURSE_ID/assessments" "$ASSESSMENT_DATA" "$TEACHER_TOKEN")
ASSESSMENT_ID=$(echo "$ASSESSMENT_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$ASSESSMENT_ID" ]; then
    log_test "Assessment Creation" "true"
else
    log_test "Assessment Creation" "false" "No assessment ID received"
    exit 1
fi

# Get assessment
GET_ASSESSMENT_RESPONSE=$(make_request "GET" "/api/protected/assessments/$ASSESSMENT_ID" "" "$TEACHER_TOKEN")
if echo "$GET_ASSESSMENT_RESPONSE" | grep -q "\"id\":\"$ASSESSMENT_ID\""; then
    log_test "Get Assessment" "true"
else
    log_test "Get Assessment" "false"
fi

# Update assessment
UPDATE_DATA="{\"title\":\"Updated Test Quiz $TIMESTAMP\"}"
UPDATE_RESPONSE=$(make_request "PUT" "/api/protected/assessments/$ASSESSMENT_ID" "$UPDATE_DATA" "$TEACHER_TOKEN")
if echo "$UPDATE_RESPONSE" | grep -q "Updated Test Quiz"; then
    log_test "Update Assessment" "true"
else
    log_test "Update Assessment" "false"
fi

echo -e "\n${BLUE}❓ Testing Question Management...${NC}"

# Create multiple choice question
MC_QUESTION_DATA="{\"type\":\"multiple_choice\",\"questionText\":\"What is 2 + 2?\",\"options\":\"[\\\"3\\\",\\\"4\\\",\\\"5\\\",\\\"6\\\"]\",\"correctAnswer\":\"4\",\"points\":2,\"order\":1}"
MC_RESPONSE=$(make_request "POST" "/api/protected/assessments/$ASSESSMENT_ID/questions" "$MC_QUESTION_DATA" "$TEACHER_TOKEN")
MC_QUESTION_ID=$(echo "$MC_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$MC_QUESTION_ID" ]; then
    log_test "Create Multiple Choice Question" "true"
else
    log_test "Create Multiple Choice Question" "false"
fi

# Create true/false question
TF_QUESTION_DATA="{\"type\":\"true_false\",\"questionText\":\"The sky is blue.\",\"correctAnswer\":\"true\",\"points\":1,\"order\":2}"
TF_RESPONSE=$(make_request "POST" "/api/protected/assessments/$ASSESSMENT_ID/questions" "$TF_QUESTION_DATA" "$TEACHER_TOKEN")
TF_QUESTION_ID=$(echo "$TF_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$TF_QUESTION_ID" ]; then
    log_test "Create True/False Question" "true"
else
    log_test "Create True/False Question" "false"
fi

# Get questions
QUESTIONS_RESPONSE=$(make_request "GET" "/api/protected/assessments/$ASSESSMENT_ID/questions" "" "$TEACHER_TOKEN")
QUESTION_COUNT=$(echo "$QUESTIONS_RESPONSE" | grep -o '"id":"[^"]*' | wc -l)

if [ "$QUESTION_COUNT" -ge 2 ]; then
    log_test "Get Questions" "true" "Found $QUESTION_COUNT questions"
else
    log_test "Get Questions" "false" "Expected 2+ questions, found $QUESTION_COUNT"
fi

echo -e "\n${BLUE}📝 Testing Assessment Taking...${NC}"

# Student starts assessment
START_RESPONSE=$(make_request "POST" "/api/protected/assessments/$ASSESSMENT_ID/start" "{}" "$STUDENT_TOKEN")
SUBMISSION_ID=$(echo "$START_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$SUBMISSION_ID" ]; then
    log_test "Start Assessment" "true"
else
    log_test "Start Assessment" "false"
    exit 1
fi

# Submit answers
if [ -n "$MC_QUESTION_ID" ]; then
    MC_ANSWER_DATA="{\"questionId\":\"$MC_QUESTION_ID\",\"answer\":\"4\"}"
    MC_ANSWER_RESPONSE=$(make_request "POST" "/api/protected/submissions/$SUBMISSION_ID/answers" "$MC_ANSWER_DATA" "$STUDENT_TOKEN")
    if echo "$MC_ANSWER_RESPONSE" | grep -q '"id"'; then
        log_test "Submit Multiple Choice Answer" "true"
    else
        log_test "Submit Multiple Choice Answer" "false"
    fi
fi

if [ -n "$TF_QUESTION_ID" ]; then
    TF_ANSWER_DATA="{\"questionId\":\"$TF_QUESTION_ID\",\"answer\":\"true\"}"
    TF_ANSWER_RESPONSE=$(make_request "POST" "/api/protected/submissions/$SUBMISSION_ID/answers" "$TF_ANSWER_DATA" "$STUDENT_TOKEN")
    if echo "$TF_ANSWER_RESPONSE" | grep -q '"id"'; then
        log_test "Submit True/False Answer" "true"
    else
        log_test "Submit True/False Answer" "false"
    fi
fi

# Submit assessment
SUBMIT_RESPONSE=$(make_request "POST" "/api/protected/submissions/$SUBMISSION_ID/submit" "{}" "$STUDENT_TOKEN")
if echo "$SUBMIT_RESPONSE" | grep -q '"status":"submitted"'; then
    log_test "Submit Assessment" "true"
    
    # Check score
    SCORE=$(echo "$SUBMIT_RESPONSE" | grep -o '"score":[0-9]*' | cut -d':' -f2)
    if [ "$SCORE" = "3" ]; then
        log_test "Score Calculation" "true" "Score: $SCORE/3"
    else
        log_test "Score Calculation" "false" "Expected 3, got $SCORE"
    fi
else
    log_test "Submit Assessment" "false"
fi

echo -e "\n${BLUE}📊 Testing Results Management...${NC}"

# Teacher views submissions
SUBMISSIONS_RESPONSE=$(make_request "GET" "/api/protected/assessments/$ASSESSMENT_ID/submissions" "" "$TEACHER_TOKEN")
if echo "$SUBMISSIONS_RESPONSE" | grep -q '"id"'; then
    log_test "Teacher View Submissions" "true"
else
    log_test "Teacher View Submissions" "false"
fi

echo -e "\n${BLUE}🔄 Testing Status Management...${NC}"

# Publish assessment
PUBLISH_DATA="{\"status\":\"published\"}"
PUBLISH_RESPONSE=$(make_request "PUT" "/api/protected/assessments/$ASSESSMENT_ID" "$PUBLISH_DATA" "$TEACHER_TOKEN")
if echo "$PUBLISH_RESPONSE" | grep -q '"status":"published"'; then
    log_test "Publish Assessment" "true"
else
    log_test "Publish Assessment" "false"
fi

# Close assessment
CLOSE_DATA="{\"status\":\"closed\"}"
CLOSE_RESPONSE=$(make_request "PUT" "/api/protected/assessments/$ASSESSMENT_ID" "$CLOSE_DATA" "$TEACHER_TOKEN")
if echo "$CLOSE_RESPONSE" | grep -q '"status":"closed"'; then
    log_test "Close Assessment" "true"
else
    log_test "Close Assessment" "false"
fi

echo -e "\n${BLUE}❌ Testing Error Handling...${NC}"

# Try to create assessment with empty title
INVALID_DATA="{\"title\":\"\",\"description\":\"Should fail\"}"
INVALID_RESPONSE=$(make_request "POST" "/api/protected/courses/$COURSE_ID/assessments" "$INVALID_DATA" "$TEACHER_TOKEN" 2>/dev/null)
if echo "$INVALID_RESPONSE" | grep -q "error\|message"; then
    log_test "Invalid Data Handling" "true"
else
    log_test "Invalid Data Handling" "false"
fi

# Try to access non-existent assessment
NONEXISTENT_RESPONSE=$(make_request "GET" "/api/protected/assessments/nonexistent" "" "$TEACHER_TOKEN" 2>/dev/null)
if echo "$NONEXISTENT_RESPONSE" | grep -q "error\|message\|not found"; then
    log_test "Non-existent Resource Handling" "true"
else
    log_test "Non-existent Resource Handling" "false"
fi

# Summary
echo -e "\n============================================================"
echo -e "${BLUE}🎯 TEST SUMMARY${NC}"
echo -e "============================================================"
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
TOTAL=$((PASSED + FAILED))
echo -e "${BLUE}📊 Total: $TOTAL${NC}"
if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED * 100) / TOTAL ))
    echo -e "${BLUE}🎯 Success Rate: ${SUCCESS_RATE}%${NC}"
fi

echo -e "\n${BLUE}🏆 FEATURES TESTED:${NC}"
echo -e "${GREEN}✅ User Authentication${NC}"
echo -e "${GREEN}✅ Course Management${NC}"
echo -e "${GREEN}✅ Assessment CRUD Operations${NC}"
echo -e "${GREEN}✅ Question Management${NC}"
echo -e "${GREEN}✅ Assessment Taking Flow${NC}"
echo -e "${GREEN}✅ Answer Submission${NC}"
echo -e "${GREEN}✅ Score Calculation${NC}"
echo -e "${GREEN}✅ Results Management${NC}"
echo -e "${GREEN}✅ Status Management${NC}"
echo -e "${GREEN}✅ Error Handling${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All assessment features working correctly!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Check the output above.${NC}"
    exit 1
fi