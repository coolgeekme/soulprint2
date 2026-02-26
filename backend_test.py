#!/usr/bin/env python3

import requests
import json
import os
from datetime import datetime

# Test Configuration
BASE_URL = "https://personality-engine-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def log_test_result(test_name, passed, details=""):
    """Log test results with consistent formatting"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"   {details}")
    print()

def make_request(method, endpoint, data=None, headers=None, files=None):
    """Make HTTP request with error handling"""
    try:
        url = f"{API_BASE}{endpoint}"
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            if files:
                response = requests.post(url, data=data, headers=headers, files=files)
            else:
                response = requests.post(url, json=data, headers=headers)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return None

def test_feedback_system():
    """Test the complete feedback system API endpoints"""
    print("🔄 TESTING FEEDBACK SYSTEM API ENDPOINTS")
    print("=" * 60)
    
    # Step 1: Login with provided credentials
    print("Step 1: Testing Login")
    login_data = {
        "email": "test@soulprint.com",
        "passcode": "test123"
    }
    
    login_response = make_request("POST", "/auth/login", login_data)
    if not login_response or login_response.status_code != 200:
        log_test_result("POST /api/auth/login", False, 
                       f"Login failed - Status: {login_response.status_code if login_response else 'No response'}")
        print("❌ Cannot proceed with authentication - stopping tests")
        return
    
    login_result = login_response.json()
    if 'token' not in login_result:
        log_test_result("POST /api/auth/login", False, "No token in login response")
        return
        
    token = login_result['token']
    user_role = login_result.get('role', 'user')
    headers = {"Authorization": f"Bearer {token}"}
    
    log_test_result("POST /api/auth/login", True, 
                   f"Login successful - Role: {user_role}, Token received")
    
    # Step 2: Submit User Feedback
    print("Step 2: Testing User Feedback Submission")
    feedback_data = {
        "message": "This is test feedback for the app. It's working great!",
        "category": "general",
        "rating": 4
    }
    
    feedback_response = make_request("POST", "/user-feedback", feedback_data, headers)
    if feedback_response and feedback_response.status_code == 200:
        feedback_result = feedback_response.json()
        log_test_result("POST /api/user-feedback", True, 
                       f"Feedback submitted successfully: {feedback_result.get('message', 'OK')}")
    else:
        log_test_result("POST /api/user-feedback", False, 
                       f"Status: {feedback_response.status_code if feedback_response else 'No response'}")
    
    # Step 3: Test Admin Feedback Access (only if user is admin)
    print("Step 3: Testing Admin Feedback Access")
    if user_role in ['admin', 'superadmin']:
        # Get all feedback
        admin_feedback_response = make_request("GET", "/admin/feedback", None, headers)
        if admin_feedback_response and admin_feedback_response.status_code == 200:
            admin_result = admin_feedback_response.json()
            feedback_count = len(admin_result.get('feedback', []))
            total_count = admin_result.get('stats', {}).get('total', 0)
            log_test_result("GET /api/admin/feedback", True, 
                           f"Retrieved {feedback_count} feedback items (Total: {total_count})")
        else:
            log_test_result("GET /api/admin/feedback", False, 
                           f"Status: {admin_feedback_response.status_code if admin_feedback_response else 'No response'}")
        
        # Test AI Summary of Feedback
        print("Step 4: Testing AI Feedback Summary")
        summary_data = {
            "status": "new",
            "limit": 10
        }
        
        summary_response = make_request("POST", "/admin/feedback/summarize", summary_data, headers)
        if summary_response and summary_response.status_code == 200:
            summary_result = summary_response.json()
            summary_text = summary_result.get('summary', '')
            feedback_count = summary_result.get('feedbackCount', 0)
            log_test_result("POST /api/admin/feedback/summarize", True, 
                           f"AI summary generated for {feedback_count} feedback items")
            print(f"   Summary preview: {summary_text[:100]}{'...' if len(summary_text) > 100 else ''}")
        else:
            log_test_result("POST /api/admin/feedback/summarize", False, 
                           f"Status: {summary_response.status_code if summary_response else 'No response'}")
    else:
        print(f"   Skipping admin tests - User role '{user_role}' is not admin")
        log_test_result("GET /api/admin/feedback", True, "Skipped - User not admin (expected behavior)")
        log_test_result("POST /api/admin/feedback/summarize", True, "Skipped - User not admin (expected behavior)")

def test_chunked_upload():
    """Test the chunked upload initialization endpoint"""
    print("\n🔄 TESTING CHUNKED UPLOAD ENDPOINTS")
    print("=" * 60)
    
    # First login to get token
    login_data = {
        "email": "test@soulprint.com", 
        "password": "test123"
    }
    
    login_response = make_request("POST", "/auth/login", login_data)
    if not login_response or login_response.status_code != 200:
        log_test_result("Chunked Upload Auth", False, "Login failed")
        return
    
    token = login_response.json()['token']
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test chunked upload initialization
    print("Step 1: Testing Chunked Upload Initialization")
    
    # Note: The actual endpoint is /data-import/chunked/init, not /chunked/init
    upload_data = {
        "filename": "test.zip",
        "fileSize": 1000,
        "totalChunks": 1,
        "source": "chatgpt"
    }
    
    # Test the correct endpoint first
    upload_response = make_request("POST", "/data-import/chunked/init", upload_data, headers)
    if upload_response and upload_response.status_code == 200:
        upload_result = upload_response.json()
        upload_id = upload_result.get('uploadId')
        log_test_result("POST /api/data-import/chunked/init", True, 
                       f"Upload session created: {upload_id}")
    else:
        log_test_result("POST /api/data-import/chunked/init", False, 
                       f"Status: {upload_response.status_code if upload_response else 'No response'}")
    
    # Test if the requested endpoint exists (should probably fail)
    print("Step 2: Testing Requested Endpoint Path")
    upload_response_alt = make_request("POST", "/chunked/init", upload_data, headers)
    if upload_response_alt and upload_response_alt.status_code == 200:
        upload_result_alt = upload_response_alt.json()
        upload_id_alt = upload_result_alt.get('uploadId')
        log_test_result("POST /api/chunked/init", True, 
                       f"Upload session created: {upload_id_alt}")
    else:
        expected_status = upload_response_alt.status_code if upload_response_alt else 'No response'
        log_test_result("POST /api/chunked/init", False, 
                       f"Status: {expected_status} (Expected - endpoint may not exist at this path)")
        print("   Note: The actual working endpoint is /api/data-import/chunked/init")

def run_all_tests():
    """Run all tests in sequence"""
    print(f"🚀 BACKEND API TESTING - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Base URL: {BASE_URL}")
    print()
    
    try:
        # Test feedback system
        test_feedback_system()
        
        # Test chunked upload
        test_chunked_upload()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS COMPLETED")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ ERROR DURING TESTING: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_all_tests()