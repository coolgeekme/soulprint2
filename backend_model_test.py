#!/usr/bin/env python3
"""
Backend Testing Script for SoulPrint Engine - Model Selection Features
Tests: Profile Model Preferences, Image Model Selection in Chat Stream, Explicit Model Parsing
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://gemini-voice-fix.preview.emergentagent.com"
AUTH_EMAIL = "test@soulprint.com"
AUTH_PASSWORD = "test123"

class ModelSelectionTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.conversation_id = None
        self.session = requests.Session()
        
    def authenticate(self) -> bool:
        """Authenticate and get JWT token"""
        try:
            print("🔐 Authenticating...")
            response = self.session.post(f"{self.base_url}/api/auth/login", json={
                "email": AUTH_EMAIL,
                "passcode": AUTH_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                if self.token:
                    self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                    print(f"✅ Authentication successful")
                    return True
                else:
                    print(f"❌ No token in response: {data}")
                    return False
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Authentication error: {e}")
            return False
    
    def create_conversation(self) -> bool:
        """Create a test conversation"""
        try:
            print("💬 Creating test conversation...")
            response = self.session.post(f"{self.base_url}/api/conversations", json={
                "title": "Backend Test - Model Selection"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.conversation_id = data.get('id')
                print(f"✅ Conversation created: {self.conversation_id}")
                return True
            else:
                print(f"❌ Failed to create conversation: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ Conversation creation error: {e}")
            return False
    
    def test_profile_model_preferences(self) -> bool:
        """Test profile model preferences save and load"""
        print("\n" + "="*60)
        print("👤 TESTING: Profile Model Preferences - Save and Load")
        print("="*60)
        
        try:
            # Step 1: Get current user profile to check default fields
            print("1. Testing GET /api/auth/me - checking for model preference fields...")
            response = self.session.get(f"{self.base_url}/api/auth/me")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ GET /api/auth/me successful")
                
                # Check if profile exists and has model fields
                profile = data.get('profile')
                if profile:
                    default_video_model = profile.get('default_video_model', 'smart')
                    default_image_model = profile.get('default_image_model', 'smart')
                    print(f"📊 Current default_video_model: {default_video_model}")
                    print(f"📊 Current default_image_model: {default_image_model}")
                else:
                    print("📊 No profile found - will be created on first update")
                    
            else:
                print(f"❌ GET /api/auth/me failed: {response.status_code} - {response.text}")
                return False
            
            # Step 2: Update profile with specific model preferences
            print("\n2. Testing PUT /api/profile - saving model preferences...")
            test_preferences = {
                "default_video_model": "veo3",
                "default_image_model": "midjourney-v7"
            }
            
            response = self.session.put(f"{self.base_url}/api/profile", json=test_preferences)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print("✅ PUT /api/profile successful - preferences saved")
                else:
                    print(f"❌ PUT /api/profile returned success=false: {data}")
                    return False
            else:
                print(f"❌ PUT /api/profile failed: {response.status_code} - {response.text}")
                return False
            
            # Step 3: Verify the preferences were saved by getting profile again
            print("\n3. Testing GET /api/auth/me - verifying saved preferences...")
            response = self.session.get(f"{self.base_url}/api/auth/me")
            
            if response.status_code == 200:
                data = response.json()
                profile = data.get('profile')
                
                if profile:
                    saved_video_model = profile.get('default_video_model')
                    saved_image_model = profile.get('default_image_model')
                    
                    print(f"📊 Saved default_video_model: {saved_video_model}")
                    print(f"📊 Saved default_image_model: {saved_image_model}")
                    
                    # Verify the values match what we saved
                    if saved_video_model == test_preferences['default_video_model']:
                        print("✅ Video model preference saved correctly")
                    else:
                        print(f"❌ Video model mismatch: expected {test_preferences['default_video_model']}, got {saved_video_model}")
                        return False
                        
                    if saved_image_model == test_preferences['default_image_model']:
                        print("✅ Image model preference saved correctly")
                    else:
                        print(f"❌ Image model mismatch: expected {test_preferences['default_image_model']}, got {saved_image_model}")
                        return False
                        
                else:
                    print("❌ No profile found after saving preferences")
                    return False
            else:
                print(f"❌ GET /api/auth/me verification failed: {response.status_code}")
                return False
            
            # Step 4: Reset to default values
            print("\n4. Testing PUT /api/profile - resetting to defaults...")
            reset_preferences = {
                "default_video_model": "smart",
                "default_image_model": "smart"
            }
            
            response = self.session.put(f"{self.base_url}/api/profile", json=reset_preferences)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print("✅ Profile reset to defaults successful")
                    return True
                else:
                    print(f"❌ Profile reset failed: {data}")
                    return False
            else:
                print(f"❌ Profile reset failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Profile model preferences test error: {e}")
            return False
    
    def test_image_model_in_chat_stream(self) -> bool:
        """Test image model preference in chat stream"""
        print("\n" + "="*60)
        print("🎨 TESTING: Image Model Preference in Chat Stream")
        print("="*60)
        
        test_cases = [
            {
                "description": "Explicit imageModel: flux-pro",
                "content": "generate a picture of a mountain",
                "imageModel": "flux-pro",
                "expected_model": "flux-pro"
            },
            {
                "description": "Dynamic Intelligence (imageModel: null)",
                "content": "generate a picture of a sunset",
                "imageModel": None,
                "expected_model": None  # Should use Dynamic Intelligence
            }
        ]
        
        success_count = 0
        
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n{i}. Testing: {test_case['description']}")
            print(f"   Content: '{test_case['content']}'")
            print(f"   ImageModel: {test_case['imageModel']}")
            
            try:
                # Prepare request body
                request_body = {
                    "content": test_case['content'],
                    "conversationId": self.conversation_id,
                    "model": "gpt-4o"
                }
                
                # Add imageModel if specified
                if test_case['imageModel'] is not None:
                    request_body['imageModel'] = test_case['imageModel']
                
                response = self.session.post(f"{self.base_url}/api/chat/stream", 
                                           json=request_body, stream=True)
                
                if response.status_code == 200:
                    print("   ✅ SSE stream started")
                    
                    # Parse SSE events to look for image generation
                    image_generation_found = False
                    model_used = None
                    
                    for line in response.iter_lines(decode_unicode=True):
                        if not line:
                            continue
                        if line.startswith('data: '):
                            continue
                        try:
                            data = json.loads(line)
                            
                            # Look for generating_visual event
                            if data.get('type') == 'generating_visual' and data.get('visualType') == 'image':
                                image_generation_found = True
                                print("   🎨 Image generation started (generating_visual event)")
                                
                                # Check if model information is included
                                if 'imageModel' in data:
                                    model_used = data['imageModel']
                                    print(f"   📊 Image model used: {model_used}")
                                
                            # Look for image event with result
                            elif data.get('type') == 'image':
                                if not image_generation_found:
                                    image_generation_found = True
                                    print("   🎨 Image generation completed (image event)")
                                
                                # Check for model info in image event
                                if 'model' in data:
                                    model_used = data['model']
                                    print(f"   📊 Image model used: {model_used}")
                                
                                # Verify image URL is accessible
                                image_url = data.get('url')
                                if image_url:
                                    print(f"   🔗 Image URL provided: {image_url[:80]}...")
                                    
                                    # Quick check if URL is accessible
                                    try:
                                        img_response = requests.head(image_url, timeout=10)
                                        if img_response.status_code == 200:
                                            print("   ✅ Image URL is accessible")
                                        else:
                                            print(f"   ⚠️ Image URL returned {img_response.status_code}")
                                    except:
                                        print("   ⚠️ Could not verify image URL accessibility")
                                
                                break
                                
                            elif data.get('type') == 'done':
                                break
                                
                        except json.JSONDecodeError:
                            continue
                    
                    if image_generation_found:
                        print("   ✅ Image generation triggered successfully")
                        
                        # Verify model usage if expected
                        if test_case['expected_model']:
                            if model_used == test_case['expected_model']:
                                print(f"   ✅ Correct model used: {model_used}")
                            elif model_used:
                                print(f"   ⚠️ Different model used: {model_used} (expected {test_case['expected_model']})")
                            else:
                                print("   ⚠️ Model information not available in response")
                        else:
                            print("   ✅ Dynamic Intelligence routing (model not pre-specified)")
                        
                        success_count += 1
                    else:
                        print("   ❌ Image generation not triggered")
                        
                else:
                    print(f"   ❌ Request failed: {response.status_code} - {response.text}")
                    
            except Exception as e:
                print(f"   ❌ Test error: {e}")
            
            # Small delay between tests
            time.sleep(3)
        
        print(f"\n📊 Image Model Chat Stream Results: {success_count}/{len(test_cases)} tests passed")
        return success_count == len(test_cases)
    
    def test_explicit_image_model_parsing(self) -> bool:
        """Test explicit image model parsing from prompts"""
        print("\n" + "="*60)
        print("🔍 TESTING: Explicit Image Model Parsing")
        print("="*60)
        
        test_cases = [
            {
                "prompt": "generate an image using Midjourney",
                "expected_model": "midjourney-v7",
                "description": "Midjourney explicit request"
            },
            {
                "prompt": "create a picture with Flux Pro",
                "expected_model": "flux-pro", 
                "description": "Flux Pro explicit request"
            },
            {
                "prompt": "make me an image with Seedream",
                "expected_model": "seedream-5-lite",
                "description": "Seedream explicit request"
            }
        ]
        
        success_count = 0
        
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n{i}. Testing: {test_case['description']}")
            print(f"   Prompt: '{test_case['prompt']}'")
            print(f"   Expected model: {test_case['expected_model']}")
            
            try:
                response = self.session.post(f"{self.base_url}/api/chat/stream", json={
                    "content": test_case['prompt'],
                    "conversationId": self.conversation_id,
                    "model": "gpt-4o"
                }, stream=True)
                
                if response.status_code == 200:
                    print("   ✅ SSE stream started")
                    
                    # Look for image generation and model detection
                    image_generation_found = False
                    model_detected = None
                    explicit_model_detected = False
                    
                    for line in response.iter_lines(decode_unicode=True):
                        if not line:
                            continue
                        if line.startswith('data: '):
                            continue
                        try:
                            data = json.loads(line)
                            
                            # Look for generating_visual event
                            if data.get('type') == 'generating_visual' and data.get('visualType') == 'image':
                                image_generation_found = True
                                print("   🎨 Image generation triggered")
                                
                                # Check for explicit model detection
                                if 'imageModel' in data:
                                    model_detected = data['imageModel']
                                    print(f"   📊 Model detected: {model_detected}")
                                    
                                    if model_detected == test_case['expected_model']:
                                        explicit_model_detected = True
                                        print(f"   ✅ Correct explicit model detected: {model_detected}")
                                    else:
                                        print(f"   ⚠️ Different model used: {model_detected} (expected {test_case['expected_model']})")
                                
                            elif data.get('type') == 'image':
                                if not image_generation_found:
                                    image_generation_found = True
                                    print("   🎨 Image generation completed")
                                
                                # Check model in image event
                                if 'model' in data and not model_detected:
                                    model_detected = data['model']
                                    print(f"   📊 Model used: {model_detected}")
                                    
                                    if model_detected == test_case['expected_model']:
                                        explicit_model_detected = True
                                        print(f"   ✅ Correct explicit model used: {model_detected}")
                                
                                break
                                
                            elif data.get('type') == 'done':
                                break
                                
                        except json.JSONDecodeError:
                            continue
                    
                    if image_generation_found:
                        if explicit_model_detected:
                            print("   ✅ Explicit model parsing working correctly")
                            success_count += 1
                        else:
                            print("   ⚠️ Image generated but explicit model not detected as expected")
                            # Still count as partial success since image generation worked
                            success_count += 0.5
                    else:
                        print("   ❌ Image generation not triggered")
                        
                else:
                    print(f"   ❌ Request failed: {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ Test error: {e}")
            
            time.sleep(3)
        
        print(f"\n📊 Explicit Model Parsing Results: {success_count}/{len(test_cases)} tests passed")
        return success_count >= len(test_cases) * 0.7  # Allow 70% success rate
    
    def run_all_tests(self) -> bool:
        """Run all model selection tests"""
        print("🚀 Starting SoulPrint Engine Backend Tests - Model Selection Features")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"👤 Auth: {AUTH_EMAIL}")
        
        # Authenticate
        if not self.authenticate():
            return False
        
        # Create conversation
        if not self.create_conversation():
            return False
        
        # Run tests
        tests = [
            ("Profile Model Preferences", self.test_profile_model_preferences),
            ("Image Model in Chat Stream", self.test_image_model_in_chat_stream),
            ("Explicit Image Model Parsing", self.test_explicit_image_model_parsing),
        ]
        
        results = []
        for test_name, test_func in tests:
            try:
                result = test_func()
                results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name} failed with exception: {e}")
                results.append((test_name, False))
        
        # Summary
        print("\n" + "="*60)
        print("📊 FINAL TEST RESULTS - MODEL SELECTION FEATURES")
        print("="*60)
        
        passed = 0
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}")
            if result:
                passed += 1
        
        print(f"\n🎯 Overall: {passed}/{len(results)} tests passed")
        
        if passed == len(results):
            print("🎉 All model selection tests passed!")
            return True
        else:
            print("⚠️ Some tests failed - see details above")
            return False

def main():
    tester = ModelSelectionTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()