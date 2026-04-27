#!/usr/bin/env python3
"""
Backend Testing Script for SoulPrint Engine PDF Generation and Serve Endpoints
Tests the PDF generation and serve endpoints as specified in the review request.
"""

import requests
import json
import time
import sys
import os
from urllib.parse import urlparse, parse_qs

# Base URL from environment
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"

# Test credentials from review request
TEST_CREDENTIALS = {
    "regular_user": {
        "email": "testchat@example.com",
        "passcode": "Test123456"
    },
    "superadmin": {
        "email": "test@soulprint.com", 
        "passcode": "test123"
    }
}

def log_test_result(test_name, success, details=""):
    """Log test results with clear formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    {details}")
    print()

def test_auth_login():
    """Test authentication endpoints (regression check)"""
    print("=== Testing Authentication (Regression Check) ===")
    
    try:
        # Test regular user login
        response = requests.post(f"{BASE_URL}/api/auth/login", 
                               json=TEST_CREDENTIALS["regular_user"],
                               timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                log_test_result("Regular User Login", True, f"Token received: {data['token'][:20]}...")
                return data["token"]
            else:
                log_test_result("Regular User Login", False, "No token in response")
                return None
        else:
            log_test_result("Regular User Login", False, f"Status: {response.status_code}, Response: {response.text}")
            return None
            
    except Exception as e:
        log_test_result("Regular User Login", False, f"Exception: {str(e)}")
        return None

def test_superadmin_login():
    """Test superadmin login"""
    try:
        # Test superadmin login
        response = requests.post(f"{BASE_URL}/api/auth/login", 
                               json=TEST_CREDENTIALS["superadmin"],
                               timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                log_test_result("Superadmin Login", True, f"Token received: {data['token'][:20]}...")
                return data["token"]
            else:
                log_test_result("Superadmin Login", False, "No token in response")
                return None
        else:
            log_test_result("Superadmin Login", False, f"Status: {response.status_code}, Response: {response.text}")
            return None
            
    except Exception as e:
        log_test_result("Superadmin Login", False, f"Exception: {str(e)}")
        return None

def test_pdf_serve_endpoint():
    """Test GET /api/pdf/serve endpoint"""
    print("=== Testing PDF Serve Endpoint (GET /api/pdf/serve) ===")
    
    try:
        # Test 1: Missing file parameter (should return 400)
        response = requests.get(f"{BASE_URL}/api/pdf/serve", timeout=30)
        if response.status_code == 400:
            log_test_result("PDF Serve - Missing file parameter", True, "Returns 400 as expected")
        else:
            log_test_result("PDF Serve - Missing file parameter", False, f"Expected 400, got {response.status_code}")
        
        # Test 2: File path outside /tmp/ (should return 403)
        response = requests.get(f"{BASE_URL}/api/pdf/serve?file=/etc/passwd", timeout=30)
        if response.status_code == 403:
            log_test_result("PDF Serve - Path outside /tmp/", True, "Returns 403 as expected")
        else:
            log_test_result("PDF Serve - Path outside /tmp/", False, f"Expected 403, got {response.status_code}")
        
        # Test 3: Non-existent file (should return 404)
        response = requests.get(f"{BASE_URL}/api/pdf/serve?file=/tmp/nonexistent.pdf", timeout=30)
        if response.status_code == 404:
            log_test_result("PDF Serve - Non-existent file", True, "Returns 404 as expected")
        else:
            log_test_result("PDF Serve - Non-existent file", False, f"Expected 404, got {response.status_code}")
            
    except Exception as e:
        log_test_result("PDF Serve Endpoint Tests", False, f"Exception: {str(e)}")

def parse_ndjson_stream(text):
    """Parse NDJSON stream response"""
    events = []
    lines = text.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if line:
            try:
                # Handle both NDJSON and SSE formats
                if line.startswith('data: '):
                    line = line[6:]  # Remove 'data: ' prefix
                
                if line and line != '[DONE]':
                    event = json.loads(line)
                    events.append(event)
            except json.JSONDecodeError:
                continue
    
    return events

def test_pdf_generation_via_chat_stream(token):
    """Test PDF generation via POST /api/chat/stream"""
    print("=== Testing PDF Generation via Chat Stream ===")
    
    if not token:
        log_test_result("PDF Generation via Chat Stream", False, "No auth token available")
        return None
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Test PDF generation request
        pdf_request = {
            "content": "Create a PDF report on AI trends",
            "model": "gpt-4o-mini"
        }
        
        print(f"Sending PDF generation request: {pdf_request['content']}")
        
        response = requests.post(f"{BASE_URL}/api/chat/stream", 
                               json=pdf_request,
                               headers=headers,
                               timeout=60,  # Increased timeout for PDF generation
                               stream=True)
        
        if response.status_code != 200:
            log_test_result("PDF Generation Request", False, f"Status: {response.status_code}, Response: {response.text}")
            return None
        
        # Check content type
        content_type = response.headers.get('content-type', '')
        if 'text/event-stream' not in content_type:
            log_test_result("PDF Generation Content-Type", False, f"Expected text/event-stream, got {content_type}")
        else:
            log_test_result("PDF Generation Content-Type", True, "Correct content-type: text/event-stream")
        
        # Collect stream data
        stream_data = ""
        events = []
        
        print("Reading NDJSON stream...")
        for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
            if chunk:
                stream_data += chunk
                
                # Try to parse events as we receive them
                lines = stream_data.split('\n')
                for line in lines[:-1]:  # Process all complete lines
                    line = line.strip()
                    if line:
                        try:
                            if line.startswith('data: '):
                                line = line[6:]
                            if line and line != '[DONE]':
                                event = json.loads(line)
                                events.append(event)
                                print(f"Event: {event.get('type', 'unknown')} - {str(event)[:100]}...")
                        except json.JSONDecodeError:
                            continue
                
                # Keep the last incomplete line
                stream_data = lines[-1]
                
                # Check if we have a done event
                if any(event.get('type') == 'done' for event in events):
                    break
        
        # Analyze events
        event_types = [event.get('type') for event in events]
        
        # Check for required event types
        has_meta = 'meta' in event_types
        has_delta = 'delta' in event_types
        has_file = 'file' in event_types
        has_done = 'done' in event_types
        
        log_test_result("PDF Stream - Meta Event", has_meta, f"Meta events found: {event_types.count('meta')}")
        log_test_result("PDF Stream - Delta Events", has_delta, f"Delta events found: {event_types.count('delta')}")
        log_test_result("PDF Stream - File Event", has_file, f"File events found: {event_types.count('file')}")
        log_test_result("PDF Stream - Done Event", has_done, f"Done events found: {event_types.count('done')}")
        
        # Check file event details
        file_events = [event for event in events if event.get('type') == 'file']
        if file_events:
            file_event = file_events[0]
            has_url = 'url' in file_event
            has_filename = 'fileName' in file_event
            has_content_type = 'contentType' in file_event
            
            log_test_result("PDF File Event - URL field", has_url, f"URL: {file_event.get('url', 'missing')}")
            log_test_result("PDF File Event - fileName field", has_filename, f"fileName: {file_event.get('fileName', 'missing')}")
            log_test_result("PDF File Event - contentType field", has_content_type, f"contentType: {file_event.get('contentType', 'missing')}")
            
            # Test the PDF URL if it's a local serve URL
            pdf_url = file_event.get('url')
            if pdf_url and '/api/pdf/serve' in pdf_url:
                print(f"Testing generated PDF URL: {pdf_url}")
                try:
                    pdf_response = requests.get(f"{BASE_URL}{pdf_url}", timeout=30)
                    if pdf_response.status_code == 200:
                        content_type = pdf_response.headers.get('content-type', '')
                        if content_type == 'application/pdf':
                            log_test_result("Generated PDF Serve", True, f"PDF served successfully, size: {len(pdf_response.content)} bytes")
                        else:
                            log_test_result("Generated PDF Serve", False, f"Wrong content-type: {content_type}")
                    else:
                        log_test_result("Generated PDF Serve", False, f"Status: {pdf_response.status_code}")
                except Exception as e:
                    log_test_result("Generated PDF Serve", False, f"Exception: {str(e)}")
            
            return file_event.get('url')
        else:
            log_test_result("PDF Generation Overall", False, "No file event found in stream")
            return None
            
    except Exception as e:
        log_test_result("PDF Generation via Chat Stream", False, f"Exception: {str(e)}")
        return None

def main():
    """Main test execution"""
    print("🧪 SoulPrint Engine PDF Generation and Serve Endpoints Testing")
    print("=" * 70)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Credentials: {TEST_CREDENTIALS['regular_user']['email']}, {TEST_CREDENTIALS['superadmin']['email']}")
    print()
    
    # Test 1: Authentication (regression check)
    regular_token = test_auth_login()
    superadmin_token = test_superadmin_login()
    
    # Test 2: PDF Serve Endpoint
    test_pdf_serve_endpoint()
    
    # Test 3: PDF Generation via Chat Stream
    if regular_token:
        pdf_url = test_pdf_generation_via_chat_stream(regular_token)
        
        if pdf_url:
            print(f"✅ PDF Generation completed successfully!")
            print(f"   Generated PDF URL: {pdf_url}")
        else:
            print("❌ PDF Generation failed or incomplete")
    else:
        print("❌ Cannot test PDF generation - authentication failed")
    
    print("\n" + "=" * 70)
    print("🏁 PDF Generation and Serve Endpoints Testing Complete")
    print("\nNote: PDF generation may take 20-30 seconds due to Puppeteer PDF generation")
    print("The chat stream uses NDJSON format (JSON separated by \\n), NOT SSE 'data:' prefix")

if __name__ == "__main__":
    main()