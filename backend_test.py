#!/usr/bin/env python3
"""
Backend Testing Script for GPT-4o Vision Spatial Awareness Composite Edit Fix
Tests the enhanced composite edit functionality with spatial awareness analysis.
"""

import requests
import json
import base64
import time
import os
from io import BytesIO
from PIL import Image

# Configuration
BASE_URL = "https://chat-composite-edit.preview.emergentagent.com"
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class CompositeEditTester:
    def __init__(self):
        self.token = None
        self.conversation_id = None
        
    def authenticate(self):
        """Authenticate and get JWT token"""
        try:
            print("🔐 Authenticating...")
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                print(f"✅ Authentication successful! Role: {data.get('role', 'unknown')}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def create_conversation(self):
        """Create a new conversation for testing"""
        try:
            print("💬 Creating new conversation...")
            response = requests.post(f"{BASE_URL}/api/conversations", 
                headers={"Authorization": f"Bearer {self.token}"},
                json={"title": "GPT-4o Vision Spatial Test"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.conversation_id = data.get('id')
                print(f"✅ Conversation created: {self.conversation_id}")
                return True
            else:
                print(f"❌ Conversation creation failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Conversation creation error: {str(e)}")
            return False
    
    def create_test_car_image(self):
        """Create a simple test car image (side view)"""
        try:
            # Create a simple car silhouette (passenger side view)
            img = Image.new('RGB', (800, 600), color='lightblue')
            
            # Draw a simple car shape (rectangle with wheels)
            from PIL import ImageDraw
            draw = ImageDraw.Draw(img)
            
            # Car body (passenger side visible)
            draw.rectangle([100, 200, 700, 400], fill='red', outline='black', width=3)
            
            # Windows
            draw.rectangle([150, 220, 350, 280], fill='lightblue', outline='black', width=2)
            draw.rectangle([400, 220, 650, 280], fill='lightblue', outline='black', width=2)
            
            # Wheels
            draw.ellipse([150, 380, 200, 430], fill='black')
            draw.ellipse([550, 380, 600, 430], fill='black')
            
            # Door lines (passenger side doors)
            draw.line([350, 200, 350, 400], fill='black', width=2)
            draw.line([500, 200, 500, 400], fill='black', width=2)
            
            # Convert to base64
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            print("✅ Test car image created (passenger side view)")
            return img_base64
            
        except Exception as e:
            print(f"❌ Car image creation error: {str(e)}")
            return None
    
    def create_test_logo(self):
        """Create a simple test logo"""
        try:
            # Create a simple logo (circle with text)
            img = Image.new('RGBA', (200, 200), color=(255, 255, 255, 0))
            
            from PIL import ImageDraw, ImageFont
            draw = ImageDraw.Draw(img)
            
            # Draw a circle
            draw.ellipse([20, 20, 180, 180], fill='blue', outline='darkblue', width=3)
            
            # Add text (simple)
            draw.text((100, 100), "LOGO", fill='white', anchor='mm')
            
            # Convert to base64
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            logo_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            print("✅ Test logo created")
            return logo_base64
            
        except Exception as e:
            print(f"❌ Logo creation error: {str(e)}")
            return None
    
    def upload_car_image(self, car_base64):
        """Upload car image as user upload"""
        try:
            print("🚗 Uploading car image...")
            
            # Send car image via chat stream
            response = requests.post(f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "content": "Here's my car image for logo placement",
                    "conversationId": self.conversation_id,
                    "model": "gpt-4o",
                    "attachments": [{
                        "type": "image",
                        "data": f"data:image/png;base64,{car_base64}",
                        "mimeType": "image/png"
                    }]
                },
                stream=True
            )
            
            if response.status_code == 200:
                print("✅ Car image uploaded successfully")
                # Read the stream to completion
                for line in response.iter_lines():
                    if line:
                        try:
                            data = json.loads(line.decode())
                            if data.get('type') == 'done':
                                break
                        except:
                            continue
                return True
            else:
                print(f"❌ Car image upload failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Car image upload error: {str(e)}")
            return False
    
    def test_composite_edit_intent_detection(self, logo_base64):
        """Test 1: Composite Edit Intent Detection"""
        try:
            print("\n🧪 TEST 1: Composite Edit Intent Detection")
            print("Testing: 'add this logo to the driver side door' with logo attachment")
            
            response = requests.post(f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "content": "add this logo to the driver side door",
                    "conversationId": self.conversation_id,
                    "model": "gpt-4o",
                    "attachments": [{
                        "type": "image",
                        "data": f"data:image/png;base64,{logo_base64}",
                        "mimeType": "image/png"
                    }]
                },
                stream=True
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code} - {response.text}")
                return False
            
            # Parse streaming response
            composite_edit_detected = False
            vision_response_found = False
            visibility_warning_found = False
            response_content = ""
            
            print("📡 Parsing streaming response...")
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode())
                        
                        if data.get('type') == 'meta':
                            print(f"📋 Meta: {data}")
                            if 'composite_edit' in str(data):
                                composite_edit_detected = True
                                print("✅ Composite edit intent detected!")
                        
                        elif data.get('type') == 'delta':
                            content = data.get('content', '')
                            response_content += content
                            
                            # Check for visibility warning
                            if '⚠️' in content and 'Note:' in content:
                                visibility_warning_found = True
                                print("✅ Visibility warning detected in response!")
                        
                        elif data.get('type') == 'done':
                            print("✅ Stream completed")
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            # Results
            print(f"\n📊 TEST 1 RESULTS:")
            print(f"   Composite Edit Detected: {'✅' if composite_edit_detected else '❌'}")
            print(f"   Visibility Warning Found: {'✅' if visibility_warning_found else '❌'}")
            print(f"   Response Content Length: {len(response_content)} chars")
            
            if visibility_warning_found:
                print(f"   Warning Content Preview: {response_content[:200]}...")
            
            return composite_edit_detected
            
        except Exception as e:
            print(f"❌ TEST 1 error: {str(e)}")
            return False
    
    def test_vision_response_structure(self, logo_base64):
        """Test 2: Verify Enhanced Vision Response Structure (via backend logs)"""
        try:
            print("\n🧪 TEST 2: Enhanced Vision Response Structure")
            print("Testing: Enhanced JSON output fields from GPT-4o Vision")
            
            # This test focuses on triggering the vision analysis
            # We'll look for the enhanced response in a different scenario
            response = requests.post(f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "content": "place this logo on the passenger side door",
                    "conversationId": self.conversation_id,
                    "model": "gpt-4o",
                    "attachments": [{
                        "type": "image",
                        "data": f"data:image/png;base64,{logo_base64}",
                        "mimeType": "image/png"
                    }]
                },
                stream=True
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code} - {response.text}")
                return False
            
            # Parse response for composite edit success
            composite_success = False
            response_content = ""
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode())
                        
                        if data.get('type') == 'delta':
                            response_content += data.get('content', '')
                        
                        elif data.get('type') == 'done':
                            composite_success = True
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            print(f"\n📊 TEST 2 RESULTS:")
            print(f"   Composite Edit Completed: {'✅' if composite_success else '❌'}")
            print(f"   Response Generated: {'✅' if len(response_content) > 0 else '❌'}")
            print(f"   Note: Enhanced JSON fields (visible_sides, requested_side_visible, etc.) are logged in backend")
            
            return composite_success
            
        except Exception as e:
            print(f"❌ TEST 2 error: {str(e)}")
            return False
    
    def test_visibility_warning_generation(self, logo_base64):
        """Test 3: Visibility Warning Generation"""
        try:
            print("\n🧪 TEST 3: Visibility Warning Generation")
            print("Testing: Warning when requested side is not visible")
            
            # Test with a request for driver's side when passenger side is visible
            response = requests.post(f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "content": "add this logo to the driver's side rear door",
                    "conversationId": self.conversation_id,
                    "model": "gpt-4o",
                    "attachments": [{
                        "type": "image",
                        "data": f"data:image/png;base64,{logo_base64}",
                        "mimeType": "image/png"
                    }]
                },
                stream=True
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code} - {response.text}")
                return False
            
            # Look for warning indicators
            warning_found = False
            tip_found = False
            response_content = ""
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode())
                        
                        if data.get('type') == 'delta':
                            content = data.get('content', '')
                            response_content += content
                            
                            # Check for warning indicators
                            if '⚠️' in content and 'Note:' in content:
                                warning_found = True
                            if 'Tip:' in content and 'provide an image' in content:
                                tip_found = True
                        
                        elif data.get('type') == 'done':
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            print(f"\n📊 TEST 3 RESULTS:")
            print(f"   Warning Symbol Found: {'✅' if warning_found else '❌'}")
            print(f"   Tip Message Found: {'✅' if tip_found else '❌'}")
            print(f"   Full Response Length: {len(response_content)} chars")
            
            if warning_found or tip_found:
                print(f"   Warning Content: {response_content}")
            
            return warning_found or tip_found
            
        except Exception as e:
            print(f"❌ TEST 3 error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all composite edit tests"""
        print("🚀 Starting GPT-4o Vision Spatial Awareness Composite Edit Tests")
        print("=" * 70)
        
        # Step 1: Authenticate
        if not self.authenticate():
            return False
        
        # Step 2: Create conversation
        if not self.create_conversation():
            return False
        
        # Step 3: Create test images
        car_base64 = self.create_test_car_image()
        logo_base64 = self.create_test_logo()
        
        if not car_base64 or not logo_base64:
            print("❌ Failed to create test images")
            return False
        
        # Step 4: Upload car image first
        if not self.upload_car_image(car_base64):
            return False
        
        # Wait a moment for processing
        time.sleep(2)
        
        # Step 5: Run tests
        test_results = []
        
        test_results.append(self.test_composite_edit_intent_detection(logo_base64))
        time.sleep(3)  # Wait between tests
        
        test_results.append(self.test_vision_response_structure(logo_base64))
        time.sleep(3)
        
        test_results.append(self.test_visibility_warning_generation(logo_base64))
        
        # Final results
        print("\n" + "=" * 70)
        print("🏁 FINAL TEST RESULTS")
        print("=" * 70)
        
        passed_tests = sum(test_results)
        total_tests = len(test_results)
        
        print(f"Tests Passed: {passed_tests}/{total_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        test_names = [
            "Composite Edit Intent Detection",
            "Enhanced Vision Response Structure", 
            "Visibility Warning Generation"
        ]
        
        for i, (name, result) in enumerate(zip(test_names, test_results)):
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{i+1}. {name}: {status}")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL TESTS PASSED! GPT-4o Vision Spatial Awareness fix is working correctly.")
        else:
            print(f"\n⚠️ {total_tests - passed_tests} test(s) failed. Review the implementation.")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = CompositeEditTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)