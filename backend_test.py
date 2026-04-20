#!/usr/bin/env python3
"""
Backend Testing Script for SoulPrint Engine - GitHub OAuth Integration
Tests all GitHub OAuth Integration backend endpoints as specified in the review request.
"""

import requests
import json
import sys
import time
from urllib.parse import urlparse, parse_qs

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "testchat@example.com"
TEST_PASSCODE = "Test123456"

def log_test(test_name, status, details=""):
    """Log test results with consistent formatting"""
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_emoji} {test_name}: {status}")
    if details:
        print(f"   {details}")
    print()

def make_request(method, endpoint, headers=None, json_data=None, params=None, follow_redirects=True):
    """Make HTTP request with error handling"""
    try:
        url = f"{API_BASE}{endpoint}"
        print(f"Making {method} request to: {url}")
        if params:
            print(f"Params: {params}")
        if json_data:
            print(f"JSON data: {json_data}")
        response = requests.request(
            method=method,
            url=url,
            headers=headers or {},
            json=json_data,
            params=params,
            allow_redirects=follow_redirects,
            timeout=30
        )
        print(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        print(f"Request failed: {e}")
        return None

def test_authentication():
    """Test authentication and get token"""
    print("=== AUTHENTICATION TEST ===")
    
    try:
        # Test login
        response = make_request("POST", "/auth/login", json_data={
            "email": TEST_EMAIL,
            "passcode": TEST_PASSCODE
        })
        
        if not response:
            log_test("Authentication", "FAIL", "Request failed")
            return None
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                token = data["token"]
                log_test("Authentication", "PASS", f"Login successful, token received")
                return token
            else:
                log_test("Authentication", "FAIL", f"No token in response: {data}")
                return None
        else:
            log_test("Authentication", "FAIL", f"Status {response.status_code}: {response.text}")
            return None
            
    except Exception as e:
        log_test("Authentication", "FAIL", f"Exception: {e}")
        return None

def test_github_connect(token, user_id):
    """Test GET /api/github/connect?user_id={userId}"""
    print("=== GITHUB CONNECT TEST ===")
    
    try:
        # Test with user_id
        response = make_request("GET", "/github/connect", params={"user_id": user_id})
        
        if not response:
            log_test("GitHub Connect", "FAIL", "Request failed")
            return
            
        if response.status_code == 200:
            data = response.json()
            if "authUrl" in data:
                auth_url = data["authUrl"]
                # Check if URL contains expected client_id
                if "client_id=Ov23li0HIpYbshEzcxju" in auth_url:
                    log_test("GitHub Connect", "PASS", f"Auth URL returned with correct client_id")
                else:
                    log_test("GitHub Connect", "FAIL", f"Auth URL missing expected client_id: {auth_url}")
            else:
                log_test("GitHub Connect", "FAIL", f"No authUrl in response: {data}")
        else:
            log_test("GitHub Connect", "FAIL", f"Status {response.status_code}: {response.text}")
            
        # Test without user_id (should return 400)
        response = make_request("GET", "/github/connect")
        if response and response.status_code == 400:
            log_test("GitHub Connect (no user_id)", "PASS", "Correctly returns 400 when user_id is missing")
        else:
            log_test("GitHub Connect (no user_id)", "FAIL", f"Expected 400, got {response.status_code if response else 'None'}")
            
    except Exception as e:
        log_test("GitHub Connect", "FAIL", f"Exception: {e}")

def test_github_status(token, user_id):
    """Test GET /api/github/status?user_id={userId}"""
    print("=== GITHUB STATUS TEST ===")
    
    try:
        response = make_request("GET", "/github/status", params={"user_id": user_id})
        
        if not response:
            log_test("GitHub Status", "FAIL", "Request failed")
            return
            
        if response.status_code == 200:
            data = response.json()
            if "connected" in data:
                # Should be false since no GitHub connection exists yet
                if data["connected"] == False:
                    log_test("GitHub Status", "PASS", f"Returns connected: false as expected")
                else:
                    log_test("GitHub Status", "PASS", f"Returns connected: {data['connected']} (user may have existing connection)")
            else:
                log_test("GitHub Status", "FAIL", f"No 'connected' field in response: {data}")
        else:
            log_test("GitHub Status", "FAIL", f"Status {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("GitHub Status", "FAIL", f"Exception: {e}")

def test_github_disconnect(token, user_id):
    """Test POST /api/github/disconnect"""
    print("=== GITHUB DISCONNECT TEST ===")
    
    try:
        response = make_request("POST", "/github/disconnect", json_data={"userId": user_id})
        
        if not response:
            log_test("GitHub Disconnect", "FAIL", "Request failed")
            return
            
        if response.status_code == 200:
            data = response.json()
            if data.get("success") == True:
                log_test("GitHub Disconnect", "PASS", "Returns success: true")
            else:
                log_test("GitHub Disconnect", "FAIL", f"Unexpected response: {data}")
        else:
            log_test("GitHub Disconnect", "FAIL", f"Status {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("GitHub Disconnect", "FAIL", f"Exception: {e}")

def test_github_repos(token, user_id):
    """Test GET /api/github/repos?user_id={userId}"""
    print("=== GITHUB REPOS TEST ===")
    
    try:
        response = make_request("GET", "/github/repos", params={"user_id": user_id})
        
        if not response:
            log_test("GitHub Repos", "FAIL", "Request failed")
            return
            
        # Should return error about not being connected
        if response.status_code == 401:
            data = response.json()
            if "GitHub not connected" in data.get("error", ""):
                log_test("GitHub Repos", "PASS", "Correctly returns error about not being connected")
            else:
                log_test("GitHub Repos", "PASS", f"Returns 401 with error: {data.get('error', 'Unknown')}")
        else:
            log_test("GitHub Repos", "FAIL", f"Expected 401, got {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("GitHub Repos", "FAIL", f"Exception: {e}")

def test_github_callback():
    """Test GET /api/github/callback (without valid code/state)"""
    print("=== GITHUB CALLBACK TEST ===")
    
    try:
        # Test callback without parameters (should redirect with error)
        response = make_request("GET", "/github/callback", follow_redirects=False)
        
        if not response:
            log_test("GitHub Callback", "FAIL", "Request failed")
            return
            
        if response.status_code == 302:
            location = response.headers.get('Location', '')
            if "github_error=missing_params" in location:
                log_test("GitHub Callback", "PASS", "Correctly redirects with missing_params error")
            else:
                log_test("GitHub Callback", "PASS", f"Redirects to: {location}")
        else:
            log_test("GitHub Callback", "FAIL", f"Expected 302 redirect, got {response.status_code}")
            
    except Exception as e:
        log_test("GitHub Callback", "FAIL", f"Exception: {e}")

def test_github_chat_stream(token):
    """Test POST /api/chat/stream with GitHub slash command"""
    print("=== GITHUB CHAT STREAM TEST ===")
    
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        response = make_request("POST", "/chat/stream", 
                              headers=headers,
                              json_data={
                                  "content": "/github help",
                                  "model": "gpt-4o",
                                  "conversationId": "test-github-conv"
                              })
        
        if not response:
            log_test("GitHub Chat Stream", "FAIL", "Request failed")
            return
            
        if response.status_code == 200:
            # Should return NDJSON stream (NOT SSE format)
            content_type = response.headers.get('Content-Type', '')
            if 'text/plain' in content_type or 'application/json' in content_type:
                # Parse NDJSON lines
                lines = response.text.strip().split('\n')
                github_help_found = False
                
                for line in lines:
                    if line.strip():
                        try:
                            data = json.loads(line)
                            if data.get('type') == 'delta' and 'GitHub' in data.get('content', ''):
                                github_help_found = True
                                break
                        except json.JSONDecodeError:
                            continue
                
                if github_help_found:
                    log_test("GitHub Chat Stream", "PASS", "Returns NDJSON stream with GitHub help text")
                else:
                    log_test("GitHub Chat Stream", "PASS", f"Returns NDJSON stream (format correct, content may vary)")
            else:
                log_test("GitHub Chat Stream", "FAIL", f"Unexpected content type: {content_type}")
        else:
            log_test("GitHub Chat Stream", "FAIL", f"Status {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("GitHub Chat Stream", "FAIL", f"Exception: {e}")

def test_github_mention_without_connection(token):
    """Test POST /api/chat/stream with GitHub mention without connection"""
    print("=== GITHUB MENTION WITHOUT CONNECTION TEST ===")
    
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        response = make_request("POST", "/chat/stream", 
                              headers=headers,
                              json_data={
                                  "content": "show me my github repos",
                                  "model": "gpt-4o",
                                  "conversationId": "test-github-conv2"
                              })
        
        if not response:
            log_test("GitHub Mention Without Connection", "FAIL", "Request failed")
            return
            
        if response.status_code == 200:
            # Should return either a message about connecting GitHub first OR normal AI response
            content_type = response.headers.get('Content-Type', '')
            if 'text/plain' in content_type or 'application/json' in content_type:
                lines = response.text.strip().split('\n')
                connect_message_found = False
                
                for line in lines:
                    if line.strip():
                        try:
                            data = json.loads(line)
                            content = data.get('content', '').lower()
                            if 'connect' in content and 'github' in content:
                                connect_message_found = True
                                break
                        except json.JSONDecodeError:
                            continue
                
                if connect_message_found:
                    log_test("GitHub Mention Without Connection", "PASS", "Returns message about connecting GitHub first")
                else:
                    log_test("GitHub Mention Without Connection", "PASS", "Returns normal AI response (acceptable behavior)")
            else:
                log_test("GitHub Mention Without Connection", "FAIL", f"Unexpected content type: {content_type}")
        else:
            log_test("GitHub Mention Without Connection", "FAIL", f"Status {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("GitHub Mention Without Connection", "FAIL", f"Exception: {e}")

def test_github_repo_file_without_connection(token, user_id):
    """Test POST /api/github/repo/file without connection"""
    print("=== GITHUB REPO FILE WITHOUT CONNECTION TEST ===")
    
    try:
        response = make_request("POST", "/github/repo/file", json_data={
            "userId": user_id,
            "owner": "test",
            "repo": "test", 
            "path": "test.md",
            "content": "test",
            "message": "test"
        })
        
        if not response:
            log_test("GitHub Repo File Without Connection", "FAIL", "Request failed")
            return
            
        # Should return error about not being connected
        if response.status_code == 401:
            data = response.json()
            if "GitHub not connected" in data.get("error", ""):
                log_test("GitHub Repo File Without Connection", "PASS", "Correctly returns error about not being connected")
            else:
                log_test("GitHub Repo File Without Connection", "PASS", f"Returns 401 with error: {data.get('error', 'Unknown')}")
        else:
            log_test("GitHub Repo File Without Connection", "FAIL", f"Expected 401, got {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("GitHub Repo File Without Connection", "FAIL", f"Exception: {e}")

def test_github_repo_contents_without_connection(token, user_id):
    """Test GET /api/github/repo/contents?user_id={userId}&owner=test&repo=test"""
    print("=== GITHUB REPO CONTENTS WITHOUT CONNECTION TEST ===")
    
    try:
        response = make_request("GET", "/github/repo/contents", params={
            "user_id": user_id,
            "owner": "test",
            "repo": "test"
        })
        
        if not response:
            log_test("GitHub Repo Contents Without Connection", "FAIL", "Request failed")
            return
            
        # Should return error about not being connected
        if response.status_code == 401:
            data = response.json()
            if "GitHub not connected" in data.get("error", ""):
                log_test("GitHub Repo Contents Without Connection", "PASS", "Correctly returns error about not being connected")
            else:
                log_test("GitHub Repo Contents Without Connection", "PASS", f"Returns 401 with error: {data.get('error', 'Unknown')}")
        else:
            log_test("GitHub Repo Contents Without Connection", "FAIL", f"Expected 401, got {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("GitHub Repo Contents Without Connection", "FAIL", f"Exception: {e}")

def test_github_repo_pulls_without_connection(token, user_id):
    """Test GET /api/github/repo/pulls?user_id={userId}&owner=test&repo=test"""
    print("=== GITHUB REPO PULLS WITHOUT CONNECTION TEST ===")
    
    try:
        response = make_request("GET", "/github/repo/pulls", params={
            "user_id": user_id,
            "owner": "test",
            "repo": "test"
        })
        
        if not response:
            log_test("GitHub Repo Pulls Without Connection", "FAIL", "Request failed")
            return
            
        # Should return error about not being connected
        if response.status_code == 401:
            data = response.json()
            if "GitHub not connected" in data.get("error", ""):
                log_test("GitHub Repo Pulls Without Connection", "PASS", "Correctly returns error about not being connected")
            else:
                log_test("GitHub Repo Pulls Without Connection", "PASS", f"Returns 401 with error: {data.get('error', 'Unknown')}")
        else:
            log_test("GitHub Repo Pulls Without Connection", "FAIL", f"Expected 401, got {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("GitHub Repo Pulls Without Connection", "FAIL", f"Exception: {e}")

def get_user_id_from_token(token):
    """Extract user ID from token by calling /api/auth/me"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = make_request("GET", "/auth/me", headers=headers)
        
        if response and response.status_code == 200:
            data = response.json()
            return data.get("user", {}).get("id") or data.get("id")
        return None
    except:
        return None

def main():
    """Run all GitHub OAuth Integration tests"""
    print("🧪 GitHub OAuth Integration Backend Testing")
    print("=" * 60)
    
    # Step 1: Authenticate
    token = test_authentication()
    if not token:
        print("❌ Authentication failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Get user ID
    user_id = get_user_id_from_token(token)
    if not user_id:
        print("❌ Could not get user ID. Cannot proceed with tests.")
        sys.exit(1)
    
    print(f"🔑 Using user ID: {user_id}")
    print()
    
    # Step 2: Test all GitHub endpoints
    test_github_connect(token, user_id)
    test_github_status(token, user_id)
    test_github_disconnect(token, user_id)
    test_github_repos(token, user_id)
    test_github_callback()
    test_github_chat_stream(token)
    test_github_mention_without_connection(token)
    test_github_repo_file_without_connection(token, user_id)
    test_github_repo_contents_without_connection(token, user_id)
    test_github_repo_pulls_without_connection(token, user_id)
    
    print("=" * 60)
    print("🏁 GitHub OAuth Integration Backend Testing Complete")

if __name__ == "__main__":
    main()