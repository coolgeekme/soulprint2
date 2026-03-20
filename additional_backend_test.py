#!/usr/bin/env python3
"""
Additional SoulPrint Backend API Tests
Tests remaining backend endpoints for completeness
"""
import requests
import json
import time
import sys

BASE_URL = "https://dashboard-profiles.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

TEST_EMAIL = "test@soulprint.com"
TEST_PASSCODE = "Test1234!"

def make_request(method, endpoint, data=None, headers=None, token=None):
    """Make HTTP request with error handling"""
    url = f"{API_BASE}/{endpoint}"
    default_headers = {"Content-Type": "application/json"}
    
    if token:
        default_headers["Authorization"] = f"Bearer {token}"
    if headers:
        default_headers.update(headers)
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=default_headers, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=default_headers, timeout=30)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=default_headers, timeout=30)
        else:
            return {"error": f"Unsupported method: {method}"}
        
        return {
            "status_code": response.status_code,
            "success": response.status_code < 400,
            "data": response.json() if response.content else {}
        }
        
    except Exception as e:
        return {"error": str(e), "status_code": 0, "success": False}

def test_additional_endpoints():
    """Test additional endpoints"""
    print("🔍 Testing Additional Backend Endpoints\n")
    
    # First, get authentication token
    login_response = make_request("POST", "auth/login", {
        "email": TEST_EMAIL,
        "passcode": TEST_PASSCODE
    })
    
    if not login_response.get("success"):
        print("❌ Failed to authenticate for additional tests")
        return False
    
    token = login_response["data"]["token"]
    
    # Test Profile Update
    print("=== Testing Profile Update ===")
    profile_response = make_request("PUT", "profile", {
        "display_name": "Test User",
        "descriptors": ["Developer", "AI Enthusiast"],
        "field": "Technology",
        "help_with": ["Coding", "AI"],
        "discovery_source": "Web Search",
        "onboarding_complete": True
    }, token=token)
    
    if profile_response.get("success"):
        print("✅ PASS | Profile Update")
    else:
        print(f"❌ FAIL | Profile Update - {profile_response.get('data', {}).get('error', 'Unknown error')}")
    
    # Test Get Conversations
    print("\n=== Testing Get Conversations ===")
    conv_response = make_request("GET", "conversations", token=token)
    
    if conv_response.get("success"):
        conversations = conv_response["data"]
        print(f"✅ PASS | Get Conversations - Found {len(conversations)} conversations")
    else:
        print(f"❌ FAIL | Get Conversations - {conv_response.get('data', {}).get('error', 'Unknown error')}")
    
    # Test Get Messages (requires conversation ID)
    if conv_response.get("success") and conversations:
        print("\n=== Testing Get Messages ===")
        conv_id = conversations[0]["id"]
        msg_response = make_request("GET", f"messages?conversationId={conv_id}", token=token)
        
        if msg_response.get("success"):
            messages = msg_response["data"]
            print(f"✅ PASS | Get Messages - Found {len(messages)} messages")
        else:
            print(f"❌ FAIL | Get Messages - {msg_response.get('data', {}).get('error', 'Unknown error')}")
    
    # Test Available Models
    print("\n=== Testing Available Models ===")
    models_response = make_request("GET", "models", token=token)
    
    if models_response.get("success"):
        models = models_response["data"]
        print(f"✅ PASS | Available Models - Found {len(models)} models")
        if models:
            print(f"    First model: {models[0].get('label', 'Unknown')}")
    else:
        print(f"❌ FAIL | Available Models - {models_response.get('data', {}).get('error', 'Unknown error')}")
    
    # Test Feedback Submission
    print("\n=== Testing Feedback Submission ===")
    feedback_response = make_request("POST", "feedback", {
        "conversation_id": conversations[0]["id"] if conversations else "test-conv-id",
        "message_id": "test-msg-id",
        "rating": "up",
        "note": "Great response!"
    }, token=token)
    
    if feedback_response.get("success"):
        print("✅ PASS | Feedback Submission")
    else:
        print(f"❌ FAIL | Feedback Submission - {feedback_response.get('data', {}).get('error', 'Unknown error')}")
    
    # Test Get User Imports
    print("\n=== Testing Get User Imports ===")
    imports_response = make_request("GET", "imports", token=token)
    
    if imports_response.get("success"):
        imports = imports_response["data"]
        print(f"✅ PASS | Get User Imports - Found {len(imports)} imports")
    else:
        print(f"❌ FAIL | Get User Imports - {imports_response.get('data', {}).get('error', 'Unknown error')}")
    
    print("\n✨ Additional endpoint testing completed!")
    return True

if __name__ == "__main__":
    test_additional_endpoints()