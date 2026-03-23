#!/usr/bin/env python3
"""
Backend Testing Suite for Scene-Based Lifestyle Mockup Feature
Tests the new scene-based mockup detection and generation functionality
"""

import requests
import json
import base64
import time
import os
from io import BytesIO
from PIL import Image, ImageDraw

# Configuration
BASE_URL = "https://chat-composite-edit.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class MockupTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        
    def authenticate(self):
        """Authenticate with test credentials"""
        print("🔐 Authenticating...")
        
        login_data = {
            "email": TEST_EMAIL,
            "passcode": TEST_PASSWORD
        }
        
        response = self.session.post(f"{API_BASE}/auth/login", json=login_data)
        
        if response.status_code == 200:
            data = response.json()
            self.auth_token = data.get('token')
            self.user_id = data.get('userId')
            
            # Set authorization header for future requests
            self.session.headers.update({
                'Authorization': f'Bearer {self.auth_token}'
            })
            
            print(f"✅ Authentication successful - User ID: {self.user_id}")
            return True
        else:
            print(f"❌ Authentication failed: {response.status_code} - {response.text}")
            return False
    
    def create_test_logo(self, text="LOGO", size=(200, 200)):
        """Create a simple test logo image"""
        img = Image.new('RGB', size, color='white')
        draw = ImageDraw.Draw(img)
        
        # Draw a simple logo with text
        draw.rectangle([10, 10, size[0]-10, size[1]-10], outline='black', width=3)
        
        # Calculate text position (center)
        bbox = draw.textbbox((0, 0), text)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (size[0] - text_width) // 2
        y = (size[1] - text_height) // 2
        
        draw.text((x, y), text, fill='black')
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    def test_scene_based_mockup(self):
        """Test Scene-based mockup request with campfire scenario"""
        print("\n🎬 Testing Scene-based Lifestyle Mockup...")
        
        # Create test logo
        logo_base64 = self.create_test_logo("CAMP LOGO")
        
        # Test data for scene-based mockup
        test_data = {
            "content": "can you add this logo to the back of a tshirt that someone is wearing that is sitting around campfire? maybe add the logo to the other outfits, a well? make this a photorealistic image.",
            "model": "gpt-4o",
            "conversationId": None,
            "attachments": [
                {
                    "base64": logo_base64,
                    "mimeType": "image/png",
                    "fileName": "camp_logo.png"
                }
            ]
        }
        
        print("📤 Sending scene-based mockup request...")
        print(f"Content: {test_data['content'][:100]}...")
        
        response = self.session.post(
            f"{API_BASE}/chat/stream",
            json=test_data,
            stream=True
        )
        
        if response.status_code != 200:
            print(f"❌ Request failed: {response.status_code} - {response.text}")
            return False
        
        # Parse NDJSON stream response
        scene_detected = False
        multiple_outfits_detected = False
        campfire_scene_detected = False
        lifestyle_message_found = False
        mockup_generated = False
        
        print("📡 Processing stream response...")
        
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    
                    if data.get('type') == 'meta':
                        print(f"📋 Meta: {data}")
                    
                    elif data.get('type') == 'delta':
                        content = data.get('content', '')
                        print(f"📝 Delta: {content[:100]}...")
                        
                        # Check for scene-based indicators
                        if 'lifestyle scene mockup' in content.lower():
                            lifestyle_message_found = True
                            print("✅ Found 'lifestyle scene mockup' message")
                        
                        if 'campfire' in content.lower():
                            campfire_scene_detected = True
                            print("✅ Campfire scene detected in response")
                    
                    elif data.get('type') == 'image':
                        mockup_generated = True
                        image_url = data.get('url')
                        content_type = data.get('contentType')
                        print(f"🖼️ Image generated: {content_type} - {image_url[:50]}...")
                        
                        if content_type == 'mockup':
                            print("✅ Mockup content type confirmed")
                    
                    elif data.get('type') == 'done':
                        print("✅ Stream completed")
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        # Verify expected behaviors
        success = True
        
        if not mockup_generated:
            print("❌ No mockup image was generated")
            success = False
        
        if not lifestyle_message_found:
            print("❌ 'lifestyle scene mockup' message not found")
            success = False
        
        if not campfire_scene_detected:
            print("❌ Campfire scene not detected in response")
            success = False
        
        if success:
            print("✅ Scene-based mockup test PASSED")
        else:
            print("❌ Scene-based mockup test FAILED")
        
        return success
    
    def test_traditional_product_mockup(self):
        """Test Traditional product mockup request"""
        print("\n🛍️ Testing Traditional Product Mockup...")
        
        # Create test logo
        logo_base64 = self.create_test_logo("BRAND")
        
        # Test data for traditional product mockup
        test_data = {
            "content": "put this logo on a t-shirt mockup",
            "model": "gpt-4o", 
            "conversationId": None,
            "attachments": [
                {
                    "base64": logo_base64,
                    "mimeType": "image/png",
                    "fileName": "brand_logo.png"
                }
            ]
        }
        
        print("📤 Sending traditional mockup request...")
        print(f"Content: {test_data['content']}")
        
        response = self.session.post(
            f"{API_BASE}/chat/stream",
            json=test_data,
            stream=True
        )
        
        if response.status_code != 200:
            print(f"❌ Request failed: {response.status_code} - {response.text}")
            return False
        
        # Parse NDJSON stream response
        traditional_message_found = False
        mockup_generated = False
        no_lifestyle_message = True
        
        print("📡 Processing stream response...")
        
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    
                    if data.get('type') == 'delta':
                        content = data.get('content', '')
                        print(f"📝 Delta: {content[:100]}...")
                        
                        # Check for traditional mockup indicators
                        if 'your t-shirt mockup is ready' in content.lower():
                            traditional_message_found = True
                            print("✅ Found traditional mockup ready message")
                        
                        # Should NOT contain lifestyle indicators
                        if 'lifestyle scene mockup' in content.lower():
                            no_lifestyle_message = False
                            print("❌ Found unexpected lifestyle message")
                    
                    elif data.get('type') == 'image':
                        mockup_generated = True
                        image_url = data.get('url')
                        content_type = data.get('contentType')
                        print(f"🖼️ Image generated: {content_type} - {image_url[:50]}...")
                    
                    elif data.get('type') == 'done':
                        print("✅ Stream completed")
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        # Verify expected behaviors
        success = True
        
        if not mockup_generated:
            print("❌ No mockup image was generated")
            success = False
        
        if not traditional_message_found:
            print("❌ Traditional mockup ready message not found")
            success = False
        
        if not no_lifestyle_message:
            print("❌ Unexpected lifestyle message found in traditional mockup")
            success = False
        
        if success:
            print("✅ Traditional product mockup test PASSED")
        else:
            print("❌ Traditional product mockup test FAILED")
        
        return success
    
    def test_scene_detection_patterns(self):
        """Test various scene detection patterns"""
        print("\n🔍 Testing Scene Detection Patterns...")
        
        test_patterns = [
            {
                "content": "someone wearing this logo sitting at a beach",
                "expected_scene": "beach",
                "description": "Beach scene pattern"
            },
            {
                "content": "people at a park wearing shirts with this design",
                "expected_scene": "park", 
                "description": "Park scene pattern"
            },
            {
                "content": "person standing by a cafe with this logo on their hoodie",
                "expected_scene": "cafe",
                "description": "Cafe scene pattern"
            },
            {
                "content": "lifestyle photo of someone in this t-shirt",
                "expected_scene": "lifestyle",
                "description": "Lifestyle keyword pattern"
            }
        ]
        
        logo_base64 = self.create_test_logo("TEST")
        
        all_passed = True
        
        for i, pattern in enumerate(test_patterns):
            print(f"\n🧪 Test {i+1}: {pattern['description']}")
            print(f"Content: {pattern['content']}")
            
            test_data = {
                "content": pattern['content'],
                "model": "gpt-4o",
                "conversationId": None,
                "attachments": [
                    {
                        "base64": logo_base64,
                        "mimeType": "image/png",
                        "fileName": "test_logo.png"
                    }
                ]
            }
            
            response = self.session.post(
                f"{API_BASE}/chat/stream",
                json=test_data,
                stream=True
            )
            
            if response.status_code != 200:
                print(f"❌ Request failed: {response.status_code}")
                all_passed = False
                continue
            
            scene_detected = False
            expected_scene_found = False
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode('utf-8'))
                        
                        if data.get('type') == 'delta':
                            content = data.get('content', '').lower()
                            
                            if 'lifestyle scene mockup' in content or 'lifestyle' in content:
                                scene_detected = True
                                print("✅ Scene-based mockup detected")
                            
                            if pattern['expected_scene'].lower() in content:
                                expected_scene_found = True
                                print(f"✅ Expected scene '{pattern['expected_scene']}' found")
                        
                        elif data.get('type') == 'done':
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            if scene_detected and expected_scene_found:
                print(f"✅ Pattern test {i+1} PASSED")
            else:
                print(f"❌ Pattern test {i+1} FAILED")
                all_passed = False
            
            # Small delay between tests
            time.sleep(1)
        
        if all_passed:
            print("\n✅ All scene detection pattern tests PASSED")
        else:
            print("\n❌ Some scene detection pattern tests FAILED")
        
        return all_passed
    
    def test_multiple_outfits_detection(self):
        """Test multiple outfits detection"""
        print("\n👥 Testing Multiple Outfits Detection...")
        
        logo_base64 = self.create_test_logo("MULTI")
        
        test_data = {
            "content": "add this logo to a t-shirt that people are wearing around a campfire, maybe add the logo to the other outfits as well",
            "model": "gpt-4o",
            "conversationId": None,
            "attachments": [
                {
                    "base64": logo_base64,
                    "mimeType": "image/png",
                    "fileName": "multi_logo.png"
                }
            ]
        }
        
        print("📤 Sending multiple outfits request...")
        print(f"Content: {test_data['content']}")
        
        response = self.session.post(
            f"{API_BASE}/chat/stream",
            json=test_data,
            stream=True
        )
        
        if response.status_code != 200:
            print(f"❌ Request failed: {response.status_code}")
            return False
        
        multiple_outfits_detected = False
        group_people_mentioned = False
        
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    
                    if data.get('type') == 'delta':
                        content = data.get('content', '').lower()
                        
                        if 'other outfits' in content or 'multiple' in content or 'group' in content:
                            multiple_outfits_detected = True
                            print("✅ Multiple outfits reference detected")
                        
                        if 'group of people' in content or 'people' in content:
                            group_people_mentioned = True
                            print("✅ Group of people mentioned")
                    
                    elif data.get('type') == 'done':
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        success = multiple_outfits_detected or group_people_mentioned
        
        if success:
            print("✅ Multiple outfits detection test PASSED")
        else:
            print("❌ Multiple outfits detection test FAILED")
        
        return success
    
    def run_all_tests(self):
        """Run all mockup tests"""
        print("🚀 Starting Scene-Based Lifestyle Mockup Testing Suite")
        print("=" * 60)
        
        if not self.authenticate():
            print("❌ Authentication failed - cannot proceed with tests")
            return False
        
        test_results = []
        
        # Test 1: Scene-based mockup (main feature)
        test_results.append(("Scene-based Mockup", self.test_scene_based_mockup()))
        
        # Test 2: Traditional product mockup (should still work)
        test_results.append(("Traditional Product Mockup", self.test_traditional_product_mockup()))
        
        # Test 3: Scene detection patterns
        test_results.append(("Scene Detection Patterns", self.test_scene_detection_patterns()))
        
        # Test 4: Multiple outfits detection
        test_results.append(("Multiple Outfits Detection", self.test_multiple_outfits_detection()))
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        passed = 0
        total = len(test_results)
        
        for test_name, result in test_results:
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{test_name:<30} {status}")
            if result:
                passed += 1
        
        print("-" * 60)
        print(f"Total: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - Scene-based lifestyle mockup feature is working correctly!")
            return True
        else:
            print("⚠️ SOME TESTS FAILED - Please review the failed tests above")
            return False

def main():
    """Main test execution"""
    tester = MockupTester()
    success = tester.run_all_tests()
    
    if success:
        exit(0)
    else:
        exit(1)

if __name__ == "__main__":
    main()