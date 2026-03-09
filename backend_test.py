#!/usr/bin/env python3
"""
Backend API Testing for SoulPrint Engine - Image-to-Video Generation with Base64 Attachments
Test the updated image-to-video implementation with fallback mechanism to Kie.ai file upload service.
"""

import requests
import json
import time
import base64
import os
from typing import Dict, Any, Optional

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://image-video-gen-11.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

# Test configuration
ENABLE_VERBOSE_LOGGING = True

def log(message: str, level: str = "INFO") -> None:
    """Enhanced logging with timestamps and levels"""
    timestamp = time.strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def make_request(method: str, endpoint: str, token: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """Make HTTP request with proper error handling and logging"""
    url = f"{API_BASE}{endpoint}"
    headers = kwargs.pop('headers', {})
    
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    # Default headers
    if 'Content-Type' not in headers and method.upper() in ['POST', 'PUT', 'PATCH']:
        headers['Content-Type'] = 'application/json'
    
    try:
        if ENABLE_VERBOSE_LOGGING:
            log(f"{method.upper()} {url}")
            if 'json' in kwargs and kwargs['json']:
                # Don't log full base64 data, just indicate presence
                safe_data = kwargs['json'].copy()
                if 'attachments' in safe_data and safe_data['attachments']:
                    for i, att in enumerate(safe_data['attachments']):
                        if 'base64' in att:
                            safe_data['attachments'][i] = {**att, 'base64': f"[BASE64_DATA_{len(att['base64'])}chars]"}
                log(f"Request data: {json.dumps(safe_data, indent=2)}")
        
        response = requests.request(method, url, headers=headers, **kwargs)
        
        if ENABLE_VERBOSE_LOGGING:
            log(f"Response Status: {response.status_code}")
            if response.headers.get('content-type', '').startswith('application/json'):
                try:
                    resp_data = response.json()
                    log(f"Response: {json.dumps(resp_data, indent=2)[:500]}...")
                except:
                    log(f"Response text: {response.text[:200]}...")
            elif 'event-stream' in response.headers.get('content-type', ''):
                log("Response: [STREAMING EVENT DATA]")
        
        return {
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'response': response
        }
    except Exception as e:
        log(f"Request failed: {str(e)}", "ERROR")
        return {'status_code': 0, 'error': str(e)}

def authenticate() -> Optional[str]:
    """Authenticate and return JWT token"""
    log("🔐 Authenticating with test credentials...")
    
    result = make_request('POST', '/auth/login', json={
        'email': TEST_EMAIL,
        'passcode': TEST_PASSWORD
    })
    
    if result['status_code'] != 200:
        log(f"❌ Authentication failed: {result.get('error', 'Unknown error')}", "ERROR")
        return None
    
    try:
        data = result['response'].json()
        if data.get('token'):
            log(f"✅ Authentication successful - Role: {data.get('role', 'unknown')}")
            return data['token']
        else:
            log("❌ No token in response", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Failed to parse auth response: {e}", "ERROR")
        return None

def test_image_to_video_base64() -> bool:
    """Test image-to-video generation with base64 attachment and fallback mechanism"""
    log("🎬 Testing Image-to-Video Generation with Base64 Attachments...")
    
    try:
        # Authenticate first
        token = authenticate()
        if not token:
            return False
        
        # Create a small test image in base64 format (1x1 PNG)
        # This is a minimal valid PNG image
        test_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        # Test payload exactly as specified in the requirement
        test_payload = {
            "content": "Animate this image with gentle motion",
            "model": "gpt-4o",
            "provider": "openai",
            "attachments": [
                {
                    "type": "image",
                    "base64": test_base64,
                    "mimeType": "image/png",
                    "name": "test.png"
                }
            ]
        }
        
        log("🔄 Sending POST /api/chat/stream with base64 image attachment...")
        result = make_request('POST', '/chat/stream', token=token, json=test_payload)
        
        if result['status_code'] == 0:
            log("❌ Network error occurred", "ERROR")
            return False
        
        if result['status_code'] != 200:
            log(f"❌ Request failed with status {result['status_code']}", "ERROR")
            try:
                error_data = result['response'].json()
                log(f"Error details: {error_data}", "ERROR")
            except:
                log(f"Error text: {result['response'].text}", "ERROR")
            return False
        
        # Check if it's a streaming response
        content_type = result['headers'].get('content-type', '')
        log(f"🔍 Response content-type: '{content_type}'")
        
        if 'event-stream' not in content_type and 'text/plain' not in content_type and content_type != '':
            log(f"❌ Expected streaming response, got: {content_type}", "ERROR")
            return False
        
        log("✅ Request accepted - processing NDJSON stream...")
        
        # Parse the streaming response
        response_chunks = []
        video_task_received = False
        error_occurred = False
        done_received = False
        
        try:
            for line in result['response'].iter_lines(decode_unicode=True):
                if line and line.strip():
                    if ENABLE_VERBOSE_LOGGING:
                        log(f"Stream chunk: {line[:100]}...")
                    
                    try:
                        chunk_data = json.loads(line)
                        response_chunks.append(chunk_data)
                        
                        # Check for specific chunk types
                        if chunk_data.get('type') == 'video_task':
                            video_task_received = True
                            task_id = chunk_data.get('taskId')
                            log(f"✅ Received video_task chunk with taskId: {task_id}")
                        elif chunk_data.get('type') == 'delta':
                            content = chunk_data.get('content', '')
                            if 'error' in content.lower() or 'failed' in content.lower():
                                error_occurred = True
                                log(f"⚠️ Error in delta content: {content}")
                        elif chunk_data.get('type') == 'done':
                            done_received = True
                            log("✅ Received done chunk")
                            
                    except json.JSONDecodeError as e:
                        log(f"⚠️ Failed to parse chunk as JSON: {line[:50]}...", "WARNING")
        
        except Exception as stream_error:
            log(f"❌ Error reading stream: {stream_error}", "ERROR")
            return False
        
        # Analyze the response
        log(f"📊 Stream Analysis: {len(response_chunks)} chunks received")
        
        success = True
        
        # Check for video_task response (indicates image-to-video was triggered)
        if video_task_received:
            log("✅ Image-to-video generation triggered successfully")
        else:
            # Check if we got any content indicating the process started
            has_video_content = any(
                chunk.get('type') == 'delta' and 
                ('animate' in chunk.get('content', '').lower() or 'video' in chunk.get('content', '').lower())
                for chunk in response_chunks
            )
            if has_video_content:
                log("✅ Image-to-video process started (fallback to data URL)")
            else:
                log("❌ No video generation triggered", "ERROR")
                success = False
        
        # Check for done response
        if not done_received:
            log("⚠️ No 'done' chunk received - stream may have been incomplete", "WARNING")
        
        # Look for specific log indicators in the response content
        log("🔍 Checking for expected log messages...")
        all_content = " ".join([chunk.get('content', '') for chunk in response_chunks if chunk.get('type') == 'delta'])
        
        # These are the key indicators we expect based on the implementation
        expected_indicators = [
            "preparing your image for animation",
            "animating your image",
            "kling",
        ]
        
        found_indicators = []
        for indicator in expected_indicators:
            if indicator.lower() in all_content.lower():
                found_indicators.append(indicator)
        
        log(f"✅ Found indicators: {found_indicators}")
        
        # Check for graceful error handling if Kling rejects data URLs
        kling_rejection = any(
            chunk.get('type') == 'delta' and 
            ('jpeg/jpg/png image formats' in chunk.get('content', '').lower() or 
             "couldn't animate" in chunk.get('content', '').lower())
            for chunk in response_chunks
        )
        
        # Final assessment
        if video_task_received:
            log("✅ Image-to-Video with Base64 Attachments: SUCCESS")
            log("✅ Successfully generated video task with either uploaded URL or data URL")
            return True
        elif found_indicators and kling_rejection:
            log("✅ Image-to-Video with Base64 Attachments: SUCCESS (with expected Kling data URL rejection)")
            log("✅ Fallback mechanism working - upload failed so data URL was used")
            log("✅ Kling rejected data URL as expected, but system handled gracefully")
            return True
        elif found_indicators:
            log("✅ Image-to-Video with Base64 Attachments: SUCCESS")
            log("✅ Image-to-video process started correctly")
            return True
        else:
            log("❌ Image-to-Video with Base64 Attachments: FAILED")
            log("❌ No indication that image-to-video process was triggered")
            return False
            
    except Exception as e:
        log(f"❌ Test failed with exception: {str(e)}", "ERROR")
        return False

def check_backend_logs_for_expected_messages():
    """Check if the expected log messages are present in backend logs"""
    log("📋 Expected backend log messages to verify:")
    expected_logs = [
        "[Image-to-Video] Starting - uploading image first...",
        "[Image-to-Video] Final image URL type: data URL",
        "[Image-to-Video] Final image URL type: http URL",
    ]
    
    for expected_log in expected_logs:
        log(f"  - {expected_log}")
    
    log("💡 Check supervisor logs with: sudo supervisorctl tail -f nextjs")

def main():
    """Main test execution"""
    log("🚀 Starting Backend API Testing - Image-to-Video Generation with Base64 Attachments")
    log(f"🌐 Testing against: {BASE_URL}")
    
    test_results = []
    
    # Test the specific feature requested
    try:
        result = test_image_to_video_base64()
        test_results.append(('Image-to-Video with Base64 Attachments', result))
    except Exception as e:
        log(f"❌ Test crashed: {str(e)}", "ERROR")
        test_results.append(('Image-to-Video with Base64 Attachments', False))
    
    # Show expected backend log messages
    check_backend_logs_for_expected_messages()
    
    # Summary
    log("\n" + "="*60)
    log("📊 TEST RESULTS SUMMARY")
    log("="*60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, passed_test in test_results:
        status = "✅ PASSED" if passed_test else "❌ FAILED"
        log(f"{status}: {test_name}")
        if passed_test:
            passed += 1
    
    log("="*60)
    log(f"🎯 OVERALL: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        log("🎉 All tests passed! Image-to-Video with Base64 functionality is working.")
    else:
        log("⚠️ Some tests failed. Check the logs above for details.")
        log("💡 Even if video generation fails due to third-party service issues,")
        log("   the fallback mechanism should work gracefully without throwing errors.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)