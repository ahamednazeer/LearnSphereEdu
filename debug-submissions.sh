#!/bin/bash

# Debug script to check submissions endpoint

API_BASE="http://localhost:5000"
TIMESTAMP=$(date +%s)

# Create teacher
TEACHER_DATA="{\"username\":\"debug_teacher_$TIMESTAMP\",\"email\":\"debug_teacher_$TIMESTAMP@test.com\",\"password\":\"password123\",\"firstName\":\"Debug\",\"lastName\":\"Teacher\",\"role\":\"teacher\"}"
TEACHER_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$TEACHER_DATA" "$API_BASE/api/auth/register")
TEACHER_TOKEN=$(echo "$TEACHER_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
echo "Teacher token: $TEACHER_TOKEN"

# Create student
STUDENT_DATA="{\"username\":\"debug_student_$TIMESTAMP\",\"email\":\"debug_student_$TIMESTAMP@test.com\",\"password\":\"password123\",\"firstName\":\"Debug\",\"lastName\":\"Student\",\"role\":\"student\"}"
STUDENT_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$STUDENT_DATA" "$API_BASE/api/auth/register")
STUDENT_TOKEN=$(echo "$STUDENT_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
echo "Student token: $STUDENT_TOKEN"

# Create course
COURSE_DATA="{\"title\":\"Debug Course $TIMESTAMP\",\"description\":\"Debug course\",\"subject\":\"Testing\"}"
COURSE_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TEACHER_TOKEN" -d "$COURSE_DATA" "$API_BASE/api/protected/courses")
COURSE_ID=$(echo "$COURSE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Course ID: $COURSE_ID"

# Enroll student
curl -s -X POST -H "Authorization: Bearer $STUDENT_TOKEN" "$API_BASE/api/protected/courses/$COURSE_ID/enroll"

# Create assessment
ASSESSMENT_DATA="{\"title\":\"Debug Assessment $TIMESTAMP\",\"description\":\"Debug assessment\"}"
ASSESSMENT_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TEACHER_TOKEN" -d "$ASSESSMENT_DATA" "$API_BASE/api/protected/courses/$COURSE_ID/assessments")
ASSESSMENT_ID=$(echo "$ASSESSMENT_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Assessment ID: $ASSESSMENT_ID"

# Create question
QUESTION_DATA="{\"type\":\"multiple_choice\",\"questionText\":\"Test question?\",\"options\":\"[\\\"A\\\",\\\"B\\\"]\",\"correctAnswer\":\"A\",\"points\":1,\"order\":1}"
QUESTION_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TEACHER_TOKEN" -d "$QUESTION_DATA" "$API_BASE/api/protected/assessments/$ASSESSMENT_ID/questions")
QUESTION_ID=$(echo "$QUESTION_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Question ID: $QUESTION_ID"

# Student starts assessment
START_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $STUDENT_TOKEN" "$API_BASE/api/protected/assessments/$ASSESSMENT_ID/start")
SUBMISSION_ID=$(echo "$START_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Submission ID: $SUBMISSION_ID"

# Submit answer
ANSWER_DATA="{\"questionId\":\"$QUESTION_ID\",\"answer\":\"A\"}"
curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $STUDENT_TOKEN" -d "$ANSWER_DATA" "$API_BASE/api/protected/submissions/$SUBMISSION_ID/answers"

# Submit assessment
SUBMIT_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $STUDENT_TOKEN" "$API_BASE/api/protected/submissions/$SUBMISSION_ID/submit")
echo "Submit response: $SUBMIT_RESPONSE"

# Check submissions
echo "Checking submissions for assessment $ASSESSMENT_ID..."
SUBMISSIONS_RESPONSE=$(curl -s -H "Authorization: Bearer $TEACHER_TOKEN" "$API_BASE/api/protected/assessments/$ASSESSMENT_ID/submissions")
echo "Submissions response: $SUBMISSIONS_RESPONSE"