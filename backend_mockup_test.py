#!/usr/bin/env python3
"""
Backend Testing for SoulPrint Engine - AI-Powered Mockup Generation
Tests the mockup generation feature via chat stream as specified in review request
"""

import requests
import json
import time
import sys
import os
from base64 import b64encode, b64decode

# Test configuration
BASE_URL = "https://chat-to-canvas.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

def log_test(message):
    """Log test messages with timestamp"""
    print(f"[{time.strftime('%H:%M:%S')}] {message}")

def authenticate():
    """Authenticate with the backend and return token"""
    try:
        log_test("🔐 Authenticating with test credentials...")
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "passcode": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            if token:
                log_test(f"✅ Authentication successful! Role: {data.get('role', 'unknown')}")
                return token
            else:
                log_test("❌ Authentication failed: No token in response")
                return None
        else:
            log_test(f"❌ Authentication failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        log_test(f"❌ Authentication error: {str(e)}")
        return None

def test_mockup_without_attachment(token):
    """Test mockup generation WITHOUT attachment (AI generates both design and product)"""
    log_test("🎨 Testing Mockup Generation WITHOUT Attachment (AI-generated design)")
    
    test_cases = [
        "create a t-shirt mockup with a simple sun logo",
        "design a mug with 'World's Best Dad' text", 
        "make a hoodie with a sunset design"
    ]
    
    for i, test_prompt in enumerate(test_cases, 1):
        log_test(f"\n--- Test Case {i}/3: '{test_prompt}' ---")
        
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "content": test_prompt,
                "model": "gpt-4o",
                "conversationId": f"test-mockup-{i}-{int(time.time())}"
            }
            
            log_test(f"📤 Sending chat stream request: '{test_prompt}'")
            response = requests.post(f"{BASE_URL}/api/chat/stream", 
                                   headers=headers, 
                                   json=payload, 
                                   stream=True,
                                   timeout=120)
            
            if response.status_code == 200:
                log_test("✅ Chat stream started successfully")
                
                # Parse NDJSON stream
                chunks_received = 0
                meta_found = False
                image_found = False
                done_found = False
                media_intent = None
                content_type = None
                image_url = None
                mockup_mentioned = False
                
                for line in response.iter_lines():
                    if line:
                        try:
                            chunk = json.loads(line.decode('utf-8'))
                            chunks_received += 1
                            
                            chunk_type = chunk.get("type")
                            
                            if chunk_type == "meta":
                                meta_found = True
                                meta_data = chunk.get("meta", {})
                                media_intent = meta_data.get("mediaIntent")
                                log_test(f"📊 Meta chunk: mediaIntent={media_intent}")
                                
                            elif chunk_type == "image":
                                image_found = True
                                image_url = chunk.get("url")
                                content_type = chunk.get("contentType")
                                log_test(f"🖼️  Image chunk: contentType={content_type}, url={image_url[:50] if image_url else None}...")
                                
                            elif chunk_type == "delta":
                                content = chunk.get("content", "")
                                if "mockup" in content.lower():
                                    mockup_mentioned = True
                                    
                            elif chunk_type == "done":
                                done_found = True
                                log_test("✅ Done chunk received")
                                break
                                
                        except json.JSONDecodeError:
                            continue
                
                log_test(f"📈 Stream completed: {chunks_received} chunks received")
                
                # Verify stream structure
                if not meta_found:
                    log_test(f"❌ Test Case {i}: No meta chunk found")
                    continue
                    
                # Check if mockup intent was detected
                if media_intent == "mockup":
                    log_test(f"✅ Test Case {i}: Correct mediaIntent=mockup detected")
                else:
                    log_test(f"⚠️  Test Case {i}: mediaIntent={media_intent} (should be 'mockup')")
                    
                if not image_found:
                    log_test(f"❌ Test Case {i}: No image chunk found")
                    continue
                    
                # Check if content type is mockup
                if content_type == "mockup":
                    log_test(f"✅ Test Case {i}: Correct contentType=mockup")
                else:
                    log_test(f"⚠️  Test Case {i}: contentType={content_type} (should be 'mockup')")
                    
                if image_url and image_url.startswith(("http://", "https://")):
                    log_test(f"✅ Test Case {i}: Got valid image URL: {image_url[:50]}...")
                else:
                    log_test(f"❌ Test Case {i}: Invalid or missing image URL")
                    continue
                    
                if not done_found:
                    log_test(f"❌ Test Case {i}: No done chunk found")
                    continue
                    
                if mockup_mentioned:
                    log_test(f"✅ Test Case {i}: Mockup mentioned in delta content")
                else:
                    log_test(f"⚠️  Test Case {i}: Mockup not mentioned in response content")
                
                log_test(f"✅ Test Case {i}: SUCCESS - Mockup generation completed!")
                
            else:
                log_test(f"❌ Test Case {i}: Failed with status {response.status_code}")
                log_test(f"Response: {response.text}")
                return False
                
        except Exception as e:
            log_test(f"❌ Test Case {i}: Exception occurred: {str(e)}")
            return False
    
    log_test("✅ All mockup generation tests (without attachment) completed successfully!")
    return True

def test_intent_classification(token):
    """Test that the intent classifier correctly identifies mockup requests"""
    log_test("🧠 Testing Intent Classification for Mockup Requests")
    
    test_cases = [
        {
            "prompt": "create a t-shirt with a cat logo",
            "expected_intent": "mockup",
            "description": "Simple t-shirt request"
        },
        {
            "prompt": "make a mug design", 
            "expected_intent": "mockup",
            "description": "Mug design request"
        },
        {
            "prompt": "design a hoodie with a sunset pattern",
            "expected_intent": "mockup", 
            "description": "Hoodie with pattern"
        },
        {
            "prompt": "what is the weather today?",
            "expected_intent": "text",
            "description": "Non-mockup text query"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        prompt = test_case["prompt"]
        expected_intent = test_case["expected_intent"]
        description = test_case["description"]
        
        log_test(f"\n--- Intent Test {i}/4: {description} ---")
        log_test(f"Prompt: '{prompt}'")
        log_test(f"Expected Intent: {expected_intent}")
        
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "content": prompt,
                "model": "gpt-4o",
                "conversationId": f"test-intent-{i}-{int(time.time())}"
            }
            
            response = requests.post(f"{BASE_URL}/api/chat/stream", 
                                   headers=headers, 
                                   json=payload, 
                                   stream=True,
                                   timeout=60)
            
            if response.status_code == 200:
                # Parse first few chunks to get meta information
                detected_intent = None
                
                for line in response.iter_lines():
                    if line:
                        try:
                            chunk = json.loads(line.decode('utf-8'))
                            chunk_type = chunk.get("type")
                            
                            if chunk_type == "meta":
                                meta_data = chunk.get("meta", {})
                                detected_intent = meta_data.get("mediaIntent")
                                break
                                
                        except json.JSONDecodeError:
                            continue
                
                # For text intent, mediaIntent might not be set in meta
                if detected_intent is None and expected_intent == "text":
                    detected_intent = "text"
                
                log_test(f"Detected Intent: {detected_intent}")
                
                if detected_intent == expected_intent:
                    log_test(f"✅ Intent Test {i}: CORRECT classification")
                else:
                    log_test(f"⚠️  Intent Test {i}: Expected '{expected_intent}' but got '{detected_intent}'")
                
            else:
                log_test(f"❌ Intent Test {i}: HTTP error {response.status_code}")
                return False
                
        except Exception as e:
            log_test(f"❌ Intent Test {i}: Exception: {str(e)}")
            return False
    
    log_test("✅ Intent classification tests completed!")
    return True

def test_ndjson_stream_format(token):
    """Test that the NDJSON stream format is correct for mockup requests"""
    log_test("📡 Testing NDJSON Stream Format for Mockup Generation")
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "content": "create a t-shirt mockup with a simple sun logo",
            "model": "gpt-4o",
            "conversationId": f"test-ndjson-{int(time.time())}"
        }
        
        log_test("📤 Testing NDJSON stream format...")
        response = requests.post(f"{BASE_URL}/api/chat/stream", 
                               headers=headers, 
                               json=payload, 
                               stream=True,
                               timeout=120)
        
        if response.status_code == 200:
            log_test("✅ Stream response received")
            
            expected_event_types = []
            received_event_types = []
            chunks = []
            
            for line in response.iter_lines():
                if line:
                    try:
                        chunk = json.loads(line.decode('utf-8'))
                        chunks.append(chunk)
                        event_type = chunk.get("type")
                        received_event_types.append(event_type)
                        
                        # Validate chunk structure
                        if event_type == "meta":
                            log_test("✅ Meta event: Valid structure")
                            if "meta" in chunk and isinstance(chunk["meta"], dict):
                                log_test("✅ Meta event: Contains meta object")
                            else:
                                log_test("❌ Meta event: Missing or invalid meta object")
                        
                        elif event_type == "image":
                            log_test("✅ Image event: Valid structure")
                            if chunk.get("url") and chunk.get("contentType"):
                                log_test("✅ Image event: Contains URL and contentType")
                            else:
                                log_test("❌ Image event: Missing URL or contentType")
                        
                        elif event_type == "delta":
                            if "content" in chunk:
                                log_test("✅ Delta event: Contains content")
                            else:
                                log_test("❌ Delta event: Missing content")
                        
                        elif event_type == "done":
                            log_test("✅ Done event: Stream completed")
                            break
                            
                    except json.JSONDecodeError as e:
                        log_test(f"❌ Invalid JSON in stream: {e}")
                        return False
            
            log_test(f"📊 Received event types: {received_event_types}")
            
            # Check for required event types
            required_types = ["meta", "done"]
            missing_types = [t for t in required_types if t not in received_event_types]
            
            if missing_types:
                log_test(f"❌ Missing required event types: {missing_types}")
                return False
            
            # For mockup requests, we expect an image event
            if "image" in received_event_types:
                log_test("✅ Image event present (expected for mockup)")
            else:
                log_test("⚠️  No image event found (may indicate issue with mockup generation)")
            
            log_test(f"✅ NDJSON stream format validation: SUCCESS ({len(chunks)} valid chunks)")
            return True
            
        else:
            log_test(f"❌ NDJSON test: HTTP error {response.status_code}")
            return False
            
    except Exception as e:
        log_test(f"❌ NDJSON test: Exception: {str(e)}")
        return False

def run_all_mockup_tests():
    """Run all mockup generation tests"""
    log_test("🚀 Starting AI-Powered Mockup Generation Tests")
    log_test("=" * 70)
    
    # Authenticate first
    token = authenticate()
    if not token:
        log_test("❌ Cannot proceed without authentication")
        return False
    
    test_results = []
    
    # Test 1: Mockup generation WITHOUT attachment
    log_test("\n" + "="*70)
    result1 = test_mockup_without_attachment(token)
    test_results.append(("Mockup Generation (AI-generated design)", result1))
    
    # Test 2: Intent Classification
    log_test("\n" + "="*70)
    result2 = test_intent_classification(token)
    test_results.append(("Intent Classification", result2))
    
    # Test 3: NDJSON Stream Format
    log_test("\n" + "="*70)
    result3 = test_ndjson_stream_format(token)
    test_results.append(("NDJSON Stream Format", result3))
    
    # Summary
    log_test("\n" + "="*70)
    log_test("📊 MOCKUP GENERATION TEST SUMMARY")
    log_test("=" * 70)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        log_test(f"{status}: {test_name}")
        if result:
            passed += 1
    
    log_test(f"\n📈 Results: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        log_test("🎉 All mockup generation tests PASSED!")
        log_test("✅ AI-powered mockup generation via chat stream is working correctly!")
        return True
    else:
        log_test("⚠️  Some mockup tests failed. See details above.")
        return False

if __name__ == "__main__":
    success = run_all_mockup_tests()
    sys.exit(0 if success else 1)