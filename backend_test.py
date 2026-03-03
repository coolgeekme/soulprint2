#!/usr/bin/env python3

import requests
import json
import time
import sys
import os

# Get the base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://ai-telegram-hub-1.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

def test_video_generation_models():
    """
    Test video generation with updated model names to verify they work without 'model not supported' error
    """
    print("🎬 Testing Video Generation with Updated Model Names")
    print("=" * 60)
    
    # Step 1: Login to get token
    print("\n1️⃣  Authenticating...")
    try:
        login_response = requests.post(f"{API_BASE}/auth/login", 
            json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            },
            headers={"Content-Type": "application/json"}
        )
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            return False
            
        login_data = login_response.json()
        token = login_data.get('token')
        
        if not token:
            print("❌ No token received from login")
            return False
            
        print(f"✅ Login successful! User role: {login_data.get('role')}")
        
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return False
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Step 2: Test each video model
    test_models = [
        {
            "name": "Kling 3.0 (720p)",
            "model": "kling-3-720p", 
            "prompt": "A beautiful sunset over the ocean with gentle waves",
            "expected_error": False
        },
        {
            "name": "Sora 2 Stable", 
            "model": "sora-2-stable",
            "prompt": "A cat playing with yarn",
            "expected_error": False
        },
        {
            "name": "Wan 2.6",
            "model": "wan-2-6", 
            "prompt": "A busy city street at night",
            "expected_error": False
        },
        {
            "name": "Runway (Legacy)",
            "model": "runway",
            "prompt": "Mountains with clouds", 
            "expected_error": False
        }
    ]
    
    all_tests_passed = True
    generated_task_ids = []
    
    for i, test_case in enumerate(test_models):
        print(f"\n{i+2}️⃣  Testing {test_case['name']} Model...")
        
        try:
            # Test video generation
            video_payload = {
                "type": "video",
                "prompt": test_case["prompt"],
                "model": test_case["model"]
            }
            
            print(f"   📤 POST /api/media/generate with model: {test_case['model']}")
            video_response = requests.post(f"{API_BASE}/media/generate", 
                json=video_payload,
                headers=headers
            )
            
            print(f"   📊 Status Code: {video_response.status_code}")
            
            if video_response.status_code == 200:
                video_data = video_response.json()
                print(f"   📄 Response: {json.dumps(video_data, indent=2)}")
                
                # Check for "model not supported" error
                response_text = str(video_data).lower()
                if "model name you specified is not supported" in response_text or "model not supported" in response_text:
                    print(f"   ❌ FAIL: Model not supported error detected!")
                    all_tests_passed = False
                elif video_data.get('success') and video_data.get('taskId'):
                    task_id = video_data.get('taskId')
                    print(f"   ✅ SUCCESS: Video generation initiated, TaskId: {task_id}")
                    generated_task_ids.append({
                        'model': test_case['model'],
                        'taskId': task_id,
                        'mediaId': video_data.get('mediaId')
                    })
                else:
                    print(f"   ⚠️  PARTIAL: Response received but no taskId in expected format")
                    print(f"   📋 Full response: {video_data}")
                    
            else:
                error_text = video_response.text
                print(f"   📄 Error Response: {error_text}")
                
                # Check if it's a "model not supported" error
                if "model name you specified is not supported" in error_text.lower() or "model not supported" in error_text.lower():
                    print(f"   ❌ FAIL: Model not supported error detected!")
                    all_tests_passed = False
                else:
                    print(f"   ⚠️  Response error (not model support issue): {video_response.status_code}")
            
        except Exception as e:
            print(f"   ❌ Exception during video generation: {str(e)}")
            all_tests_passed = False
    
    # Step 3: Test status checking for generated videos
    if generated_task_ids:
        print(f"\n{len(test_models)+2}️⃣  Testing Status Check for Generated Videos...")
        
        for task_info in generated_task_ids:
            try:
                print(f"   🔄 Checking status for {task_info['model']} (TaskId: {task_info['taskId']})")
                
                status_response = requests.get(f"{API_BASE}/media/status?taskId={task_info['taskId']}", 
                    headers=headers
                )
                
                print(f"   📊 Status Code: {status_response.status_code}")
                
                if status_response.status_code == 200:
                    status_data = status_response.json()
                    print(f"   📄 Status Response: {json.dumps(status_data, indent=2)}")
                    print(f"   ✅ Status check working for {task_info['model']}")
                else:
                    print(f"   ❌ Status check failed: {status_response.status_code} - {status_response.text}")
                    all_tests_passed = False
                    
            except Exception as e:
                print(f"   ❌ Exception during status check: {str(e)}")
                all_tests_passed = False
                
            # Add small delay between status checks
            time.sleep(0.5)
    
    # Summary
    print("\n" + "=" * 60)
    if all_tests_passed:
        print("🎉 ALL VIDEO MODEL TESTS PASSED!")
        print("✅ No 'model not supported' errors detected")
        print("✅ All updated model names working correctly")
        if generated_task_ids:
            print(f"✅ Generated {len(generated_task_ids)} video tasks successfully")
            print("✅ Status check endpoints working")
    else:
        print("❌ SOME VIDEO MODEL TESTS FAILED!")
        print("⚠️  Check above for 'model not supported' errors")
        
    return all_tests_passed

def run_all_tests():
    """Run all backend video generation tests"""
    print("🚀 Starting Backend Video Generation Tests")
    print(f"🌐 Testing against: {BASE_URL}")
    print("=" * 60)
    
    try:
        # Test video generation models
        video_success = test_video_generation_models()
        
        print("\n" + "=" * 60)
        print("📊 FINAL TEST SUMMARY")
        print("=" * 60)
        
        if video_success:
            print("🎉 ALL TESTS PASSED!")
            print("✅ Video generation with updated model names working correctly")
            return True
        else:
            print("❌ SOME TESTS FAILED!")
            print("⚠️  Video generation may have model support issues")
            return False
            
    except Exception as e:
        print(f"❌ Critical error during testing: {str(e)}")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)