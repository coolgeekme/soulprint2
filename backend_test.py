#!/usr/bin/env python3
"""
Backend Video Generation API Testing Script
Tests all video generation endpoints and diagnoses issues.
"""

import json
import time
import sys
import requests
import os
from typing import Dict, Any

# Configuration
BASE_URL = "https://ai-telegram-hub-1.preview.emergentagent.com/api"
LOGIN_EMAIL = "test@soulprint.com"
LOGIN_PASSWORD = "test123"

class VideoGenerationTester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.test_results = []
        
    def log_test_result(self, test_name: str, success: bool, message: str, details: Dict[Any, Any] = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅" if success else "❌"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {json.dumps(details, indent=2)}")
        
    def authenticate(self) -> bool:
        """Authenticate and get JWT token"""
        try:
            print("🔑 Testing authentication...")
            
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json={"email": LOGIN_EMAIL, "passcode": LOGIN_PASSWORD},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                if self.token:
                    self.session.headers.update({"Authorization": f"Bearer {self.token}"})
                    self.log_test_result("Authentication", True, f"Successfully authenticated as {data.get('role', 'unknown')}")
                    return True
                else:
                    self.log_test_result("Authentication", False, "No token received")
                    return False
            else:
                self.log_test_result("Authentication", False, f"Login failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_test_result("Authentication", False, f"Authentication error: {str(e)}")
            return False
    
    def test_direct_video_generation(self) -> tuple[bool, str]:
        """Test POST /api/generate/video endpoint"""
        try:
            print("\n🎬 Testing direct video generation API...")
            
            payload = {
                "prompt": "A peaceful sunset over the ocean with gentle waves",
                "duration": 5,
                "quality": "720p",
                "aspectRatio": "16:9"
            }
            
            response = self.session.post(
                f"{BASE_URL}/generate/video",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                task_id = data.get("taskId")
                if task_id:
                    self.log_test_result(
                        "Direct Video Generation", 
                        True, 
                        f"Video generation started successfully",
                        {"taskId": task_id, "status": data.get("status")}
                    )
                    return True, task_id
                else:
                    self.log_test_result(
                        "Direct Video Generation", 
                        False, 
                        "No taskId returned in response",
                        data
                    )
                    return False, None
            else:
                error_text = response.text
                try:
                    error_data = response.json()
                    error_message = error_data.get("error", error_text)
                except:
                    error_message = error_text
                    
                self.log_test_result(
                    "Direct Video Generation", 
                    False, 
                    f"API returned {response.status_code}: {error_message}",
                    {"status_code": response.status_code, "response": error_text[:500]}
                )
                return False, None
                
        except Exception as e:
            self.log_test_result("Direct Video Generation", False, f"Request failed: {str(e)}")
            return False, None
    
    def test_video_status_polling(self, task_id: str) -> bool:
        """Test GET /api/generate/video/{taskId} endpoint"""
        if not task_id:
            self.log_test_result("Video Status Polling", False, "No taskId available for testing")
            return False
            
        try:
            print(f"\n📊 Testing video status polling for task {task_id}...")
            
            response = self.session.get(f"{BASE_URL}/generate/video/{task_id}")
            
            if response.status_code == 200:
                data = response.json()
                status = data.get("status", "unknown")
                self.log_test_result(
                    "Video Status Polling", 
                    True, 
                    f"Status check successful, status: {status}",
                    data
                )
                return True
            else:
                error_text = response.text
                try:
                    error_data = response.json()
                    error_message = error_data.get("error", error_text)
                except:
                    error_message = error_text
                    
                self.log_test_result(
                    "Video Status Polling", 
                    False, 
                    f"Status check failed: {response.status_code} - {error_message}",
                    {"status_code": response.status_code, "response": error_text[:500]}
                )
                return False
                
        except Exception as e:
            self.log_test_result("Video Status Polling", False, f"Status check error: {str(e)}")
            return False
    
    def test_chat_stream_video_generation(self) -> bool:
        """Test POST /api/chat/stream with video generation prompt"""
        try:
            print("\n💬 Testing video generation via chat stream...")
            
            payload = {
                "content": "generate a video of a cat playing with yarn",
                "model": "gpt-4o"
            }
            
            response = self.session.post(
                f"{BASE_URL}/chat/stream",
                json=payload,
                headers={"Content-Type": "application/json"},
                stream=True
            )
            
            if response.status_code == 200:
                # Process NDJSON stream
                video_detected = False
                task_id = None
                content_chunks = []
                
                for line in response.iter_lines():
                    if line:
                        try:
                            data = json.loads(line.decode('utf-8'))
                            
                            if data.get("type") == "video_task":
                                video_detected = True
                                task_id = data.get("taskId")
                            elif data.get("type") == "delta":
                                content_chunks.append(data.get("content", ""))
                            elif data.get("type") == "done":
                                break
                                
                        except json.JSONDecodeError:
                            continue
                
                if video_detected and task_id:
                    self.log_test_result(
                        "Chat Stream Video Generation", 
                        True, 
                        "Video generation detected and initiated via chat stream",
                        {"taskId": task_id, "content_preview": "".join(content_chunks)[:200]}
                    )
                    return True
                else:
                    self.log_test_result(
                        "Chat Stream Video Generation", 
                        False, 
                        "No video generation detected in chat stream",
                        {"content": "".join(content_chunks)[:300]}
                    )
                    return False
            else:
                error_text = response.text
                self.log_test_result(
                    "Chat Stream Video Generation", 
                    False, 
                    f"Chat stream failed: {response.status_code} - {error_text[:200]}",
                    {"status_code": response.status_code}
                )
                return False
                
        except Exception as e:
            self.log_test_result("Chat Stream Video Generation", False, f"Chat stream error: {str(e)}")
            return False
    
    def test_media_generate_api(self) -> tuple[bool, str]:
        """Test POST /api/media/generate endpoint"""
        try:
            print("\n🎯 Testing unified media generation API...")
            
            payload = {
                "type": "video",
                "model": "runway",
                "prompt": "A serene mountain lake reflecting clouds at dawn",
                "aspectRatio": "16:9"
            }
            
            response = self.session.post(
                f"{BASE_URL}/media/generate",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                task_id = data.get("taskId")
                media_id = data.get("mediaId")
                if task_id and media_id:
                    self.log_test_result(
                        "Media Generate API", 
                        True, 
                        f"Media generation started successfully",
                        {"taskId": task_id, "mediaId": media_id, "type": data.get("type")}
                    )
                    return True, task_id
                else:
                    self.log_test_result(
                        "Media Generate API", 
                        False, 
                        "Missing taskId or mediaId in response",
                        data
                    )
                    return False, None
            else:
                error_text = response.text
                try:
                    error_data = response.json()
                    error_message = error_data.get("error", error_text)
                except:
                    error_message = error_text
                    
                self.log_test_result(
                    "Media Generate API", 
                    False, 
                    f"Media generation failed: {response.status_code} - {error_message}",
                    {"status_code": response.status_code, "response": error_text[:500]}
                )
                return False, None
                
        except Exception as e:
            self.log_test_result("Media Generate API", False, f"Media generate error: {str(e)}")
            return False, None
    
    def test_media_status_api(self, task_id: str) -> bool:
        """Test GET /api/media/status endpoint"""
        if not task_id:
            self.log_test_result("Media Status API", False, "No taskId available for testing")
            return False
            
        try:
            print(f"\n📈 Testing media status API for task {task_id}...")
            
            response = self.session.get(f"{BASE_URL}/media/status?taskId={task_id}")
            
            if response.status_code == 200:
                data = response.json()
                status = data.get("status", "unknown")
                self.log_test_result(
                    "Media Status API", 
                    True, 
                    f"Media status check successful, status: {status}",
                    data
                )
                return True
            else:
                error_text = response.text
                try:
                    error_data = response.json()
                    error_message = error_data.get("error", error_text)
                except:
                    error_message = error_text
                    
                self.log_test_result(
                    "Media Status API", 
                    False, 
                    f"Media status check failed: {response.status_code} - {error_message}",
                    {"status_code": response.status_code, "response": error_text[:500]}
                )
                return False
                
        except Exception as e:
            self.log_test_result("Media Status API", False, f"Media status error: {str(e)}")
            return False
    
    def test_kie_api_directly(self) -> bool:
        """Test Kie.ai API directly to check if the third-party service is working"""
        try:
            print("\n🔍 Testing Kie.ai API directly...")
            
            # Try to read the KIE_API_KEY from environment or make a test call
            # We'll make a simple test request to see if we get a proper error response
            
            payload = {
                "prompt": "test",
                "duration": 5,
                "quality": "720p",
                "aspectRatio": "16:9"
            }
            
            # Note: We don't have the API key in this test environment,
            # so we expect a 401 or similar auth error, not a connection error
            try:
                response = requests.post(
                    "https://api.kie.ai/api/v1/runway/generate",
                    json=payload,
                    headers={"Content-Type": "application/json", "Authorization": "Bearer invalid_key"},
                    timeout=10
                )
                
                if response.status_code in [401, 403]:
                    self.log_test_result(
                        "Kie.ai API Direct Test", 
                        True, 
                        "Kie.ai API is reachable (auth error expected with invalid key)",
                        {"status_code": response.status_code, "response": response.text[:200]}
                    )
                    return True
                elif response.status_code == 400:
                    # Bad request might indicate API is working but our request format is wrong
                    try:
                        error_data = response.json()
                        self.log_test_result(
                            "Kie.ai API Direct Test", 
                            True, 
                            "Kie.ai API is reachable (validation error)",
                            {"status_code": response.status_code, "error": error_data}
                        )
                        return True
                    except:
                        self.log_test_result(
                            "Kie.ai API Direct Test", 
                            False, 
                            f"Unexpected response: {response.status_code} - {response.text[:200]}",
                            {"status_code": response.status_code}
                        )
                        return False
                else:
                    self.log_test_result(
                        "Kie.ai API Direct Test", 
                        False, 
                        f"Unexpected status: {response.status_code} - {response.text[:200]}",
                        {"status_code": response.status_code}
                    )
                    return False
                    
            except requests.ConnectionError:
                self.log_test_result(
                    "Kie.ai API Direct Test", 
                    False, 
                    "Cannot connect to Kie.ai API (connection error)",
                    {"error": "Connection failed"}
                )
                return False
            except requests.Timeout:
                self.log_test_result(
                    "Kie.ai API Direct Test", 
                    False, 
                    "Kie.ai API request timed out",
                    {"error": "Timeout"}
                )
                return False
                
        except Exception as e:
            self.log_test_result("Kie.ai API Direct Test", False, f"Direct API test error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all video generation tests"""
        print("🚀 Starting Video Generation API Tests\n")
        
        # Step 1: Authenticate
        if not self.authenticate():
            print("\n❌ Authentication failed. Cannot proceed with tests.")
            return self.generate_summary()
        
        # Step 2: Test direct video generation API
        video_success, task_id = self.test_direct_video_generation()
        
        # Step 3: Test video status polling if we got a task ID
        if task_id:
            self.test_video_status_polling(task_id)
        
        # Step 4: Test video generation via chat stream
        self.test_chat_stream_video_generation()
        
        # Step 5: Test unified media generation API
        media_success, media_task_id = self.test_media_generate_api()
        
        # Step 6: Test media status API if we got a task ID
        if media_task_id:
            self.test_media_status_api(media_task_id)
        
        # Step 7: Test Kie.ai API directly
        self.test_kie_api_directly()
        
        return self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "="*60)
        print("📋 VIDEO GENERATION TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        print("\n📊 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        print("\n🔍 DIAGNOSIS:")
        
        # Analyze results to provide diagnosis
        auth_success = any(r["success"] and "Authentication" in r["test"] for r in self.test_results)
        direct_api_success = any(r["success"] and "Direct Video Generation" in r["test"] for r in self.test_results)
        chat_stream_success = any(r["success"] and "Chat Stream Video Generation" in r["test"] for r in self.test_results)
        media_api_success = any(r["success"] and "Media Generate API" in r["test"] for r in self.test_results)
        kie_api_reachable = any(r["success"] and "Kie.ai API Direct Test" in r["test"] for r in self.test_results)
        
        if not auth_success:
            print("- ❌ Authentication is failing - check credentials")
        elif not kie_api_reachable:
            print("- ❌ Kie.ai API is not reachable - check third-party service")
        elif not direct_api_success and not chat_stream_success and not media_api_success:
            print("- ❌ All video generation endpoints are failing")
            print("- 🔍 Check KIE_API_KEY environment variable")
            print("- 🔍 Check Kie.ai account credits/subscription status")
        elif direct_api_success or media_api_success:
            print("- ✅ Direct API endpoints are working")
            if not chat_stream_success:
                print("- ⚠️  Chat stream video detection may have issues")
        else:
            print("- ⚠️  Mixed results - some endpoints working, others failing")
        
        print("\n📝 RECOMMENDATIONS:")
        
        # Find specific error messages to provide targeted recommendations
        errors = [r for r in self.test_results if not r["success"]]
        error_messages = [r["message"] for r in errors]
        
        if any("401" in msg or "Unauthorized" in msg or "authentication" in msg.lower() for msg in error_messages):
            print("- Check KIE_API_KEY environment variable is set correctly")
            print("- Verify Kie.ai API key is valid and not expired")
        
        if any("400" in msg or "validation" in msg.lower() for msg in error_messages):
            print("- Check request format and required parameters")
            print("- Verify Kie.ai API endpoint URLs are correct")
        
        if any("timeout" in msg.lower() or "connection" in msg.lower() for msg in error_messages):
            print("- Check network connectivity to Kie.ai services")
            print("- Verify firewall/proxy settings allow API access")
        
        if any("credit" in msg.lower() or "balance" in msg.lower() or "subscription" in msg.lower() for msg in error_messages):
            print("- Check Kie.ai account has sufficient credits")
            print("- Verify subscription status is active")
        
        return {
            "total_tests": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": (passed_tests/total_tests)*100,
            "results": self.test_results
        }

def main():
    """Main function to run video generation tests"""
    tester = VideoGenerationTester()
    summary = tester.run_all_tests()
    
    # Exit with non-zero code if any tests failed
    if summary["failed"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()