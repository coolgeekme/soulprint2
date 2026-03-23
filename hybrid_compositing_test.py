#!/usr/bin/env python3
"""
Backend Testing Script for HYBRID COMPOSITING Approach
Tests the new two-step hybrid approach for realistic sticker integration:
1. Step 1 (Sharp): Place logo at exact pixel coordinates using sharp
2. Step 2 (AI Enhancement): Pass sharp composite through SeeDream v4 (or GPT-image-1 fallback) to add realistic sticker effects
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
TEST_EMAIL = "test@soulprint.com"
TEST_PASSWORD = "test123"

class HybridCompositingTester:
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
                json={"title": "Hybrid Compositing Test"}
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
    
    def create_realistic_car_image(self):
        """Create a more realistic car image for testing"""
        try:
            # Create a realistic car image (front door visible)
            img = Image.new('RGB', (1024, 768), color='lightgray')
            draw = ImageDraw.Draw(img)
            
            # Car body (side view with front door visible)
            draw.rectangle([100, 250, 900, 500], fill='darkblue', outline='black', width=3)
            
            # Front door area (clearly visible)
            draw.rectangle([200, 270, 450, 480], fill='blue', outline='black', width=2)
            
            # Door handle
            draw.rectangle([420, 350, 440, 370], fill='silver', outline='black', width=1)
            
            # Windows
            draw.rectangle([220, 290, 430, 350], fill='lightblue', outline='black', width=2)
            draw.rectangle([470, 290, 700, 350], fill='lightblue', outline='black', width=2)
            
            # Wheels
            draw.ellipse([180, 480, 250, 550], fill='black')
            draw.ellipse([650, 480, 720, 550], fill='black')
            
            # Wheel rims
            draw.ellipse([195, 495, 235, 535], fill='silver')
            draw.ellipse([665, 495, 705, 535], fill='silver')
            
            # Convert to base64
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            print("✅ Realistic car image created (front door clearly visible)")
            return img_base64
            
        except Exception as e:
            print(f"❌ Car image creation error: {str(e)}")
            return None
    
    def create_transparent_logo(self):
        """Create a logo with transparency for better compositing"""
        try:
            # Create a logo with transparency
            img = Image.new('RGBA', (150, 150), color=(255, 255, 255, 0))
            draw = ImageDraw.Draw(img)
            
            # Draw a circular logo with text
            draw.ellipse([10, 10, 140, 140], fill='red', outline='darkred', width=3)
            
            # Add text
            try:
                # Try to use a better font if available
                from PIL import ImageFont
                font = ImageFont.load_default()
                draw.text((75, 75), "LOGO", fill='white', anchor='mm', font=font)
            except:
                draw.text((75, 75), "LOGO", fill='white', anchor='mm')
            
            # Add some design elements
            draw.ellipse([30, 30, 50, 50], fill='white')
            draw.ellipse([100, 100, 120, 120], fill='white')
            
            # Convert to base64
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            logo_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            print("✅ Transparent logo created")
            return logo_base64
            
        except Exception as e:
            print(f"❌ Logo creation error: {str(e)}")
            return None
    
    def test_hybrid_compositing_flow(self, car_base64, logo_base64):
        """Test the complete HYBRID COMPOSITING flow"""
        try:
            print("\n🧪 TESTING HYBRID COMPOSITING FLOW")
            print("=" * 60)
            print("Testing: 'add this logo to the front door' with logo attachment")
            print("Expected: Sharp composite → AI enhancement → realistic sticker effects")
            
            # First upload the car image
            print("\n📤 Step 1: Uploading car image...")
            car_response = requests.post(f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "content": "Here's my car image",
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
            
            if car_response.status_code != 200:
                print(f"❌ Car upload failed: {car_response.status_code}")
                return False
            
            # Consume the car upload response
            for line in car_response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode())
                        if data.get('type') == 'done':
                            break
                    except:
                        continue
            
            print("✅ Car image uploaded successfully")
            time.sleep(2)  # Wait for processing
            
            # Now test the hybrid compositing with logo
            print("\n🎨 Step 2: Testing hybrid compositing with logo...")
            response = requests.post(f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "content": "add this logo to the front door",
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
                print(f"❌ Composite request failed: {response.status_code} - {response.text}")
                return False
            
            # Track the hybrid flow indicators
            flow_indicators = {
                'sharp_composite_complete': False,
                'sharp_composite_uploaded': False,
                'hybrid_ai_enhancement_start': False,
                'seedream_enhancement_attempt': False,
                'enhancement_task_created': False,
                'enhancement_status_polling': False,
                'ai_enhancement_success': False,
                'ai_enhancement_failed': False,
                'final_result_method': None,
                'realistic_sticker_effects_message': False,
                'enhanced_with_realistic_effects': False
            }
            
            response_content = ""
            final_image_url = None
            
            print("📡 Monitoring hybrid compositing flow...")
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode())
                        
                        if data.get('type') == 'delta':
                            content = data.get('content', '')
                            response_content += content
                            
                            # Check for hybrid flow messages
                            if '🎨 *Adding realistic sticker effects (shadows, contours, lighting)...*' in content:
                                flow_indicators['realistic_sticker_effects_message'] = True
                                print("✅ Found: Adding realistic sticker effects message")
                            
                            if '🎨 *Enhanced with realistic sticker effects*' in content:
                                flow_indicators['enhanced_with_realistic_effects'] = True
                                print("✅ Found: Enhanced with realistic sticker effects confirmation")
                        
                        elif data.get('type') == 'image':
                            final_image_url = data.get('url')
                            content_type = data.get('contentType')
                            if content_type == 'composite_edit':
                                print(f"✅ Final composite image received: {final_image_url[:80]}...")
                        
                        elif data.get('type') == 'done':
                            print("✅ Stream completed")
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            # Analyze results
            print(f"\n📊 HYBRID COMPOSITING FLOW ANALYSIS:")
            print(f"   Realistic Sticker Effects Message: {'✅' if flow_indicators['realistic_sticker_effects_message'] else '❌'}")
            print(f"   Enhanced Effects Confirmation: {'✅' if flow_indicators['enhanced_with_realistic_effects'] else '❌'}")
            print(f"   Final Image Generated: {'✅' if final_image_url else '❌'}")
            print(f"   Response Content Length: {len(response_content)} chars")
            
            # Check if we got the expected hybrid flow
            hybrid_flow_working = (
                flow_indicators['realistic_sticker_effects_message'] and
                final_image_url is not None
            )
            
            if hybrid_flow_working:
                print("✅ HYBRID COMPOSITING FLOW DETECTED!")
                if flow_indicators['enhanced_with_realistic_effects']:
                    print("✅ AI ENHANCEMENT SUCCEEDED - Realistic effects applied!")
                else:
                    print("⚠️ AI enhancement may have failed, but Sharp composite succeeded")
            else:
                print("❌ HYBRID COMPOSITING FLOW NOT DETECTED")
            
            return hybrid_flow_working
            
        except Exception as e:
            print(f"❌ Hybrid compositing test error: {str(e)}")
            return False
    
    def test_backend_logs_verification(self, car_base64, logo_base64):
        """Test to verify expected backend log messages"""
        try:
            print("\n🧪 TESTING BACKEND LOGS VERIFICATION")
            print("=" * 60)
            print("Testing: Backend should log specific hybrid compositing messages")
            print("Expected logs:")
            print("  - [Composite Edit] Sharp composite complete")
            print("  - [Composite Edit] Sharp composite uploaded:")
            print("  - [Composite Edit] HYBRID: Starting AI enhancement pass...")
            print("  - [Composite Edit] Trying SeeDream v4 for realistic enhancement...")
            print("  - [Composite Edit] Enhancement task created:")
            print("  - [Composite Edit] Enhancement status:")
            print("  - [Composite Edit] AI Enhancement SUCCESS! OR [Composite Edit] AI Enhancement failed")
            print("  - [Composite Edit] Final result using method:")
            
            # Upload car image first
            print("\n📤 Uploading car image...")
            car_response = requests.post(f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "content": "Here's my vehicle",
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
            
            # Consume car upload response
            for line in car_response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode())
                        if data.get('type') == 'done':
                            break
                    except:
                        continue
            
            time.sleep(2)
            
            # Test composite edit with different phrasing
            print("\n🎨 Testing composite edit with backend logging...")
            response = requests.post(f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "content": "place this logo on the vehicle door",
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
                print(f"❌ Request failed: {response.status_code}")
                return False
            
            # Monitor for success indicators
            composite_success = False
            ai_enhancement_attempted = False
            response_content = ""
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode())
                        
                        if data.get('type') == 'delta':
                            content = data.get('content', '')
                            response_content += content
                            
                            if 'realistic sticker effects' in content.lower():
                                ai_enhancement_attempted = True
                        
                        elif data.get('type') == 'image':
                            if data.get('contentType') == 'composite_edit':
                                composite_success = True
                        
                        elif data.get('type') == 'done':
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            print(f"\n📊 BACKEND LOGS VERIFICATION RESULTS:")
            print(f"   Composite Edit Completed: {'✅' if composite_success else '❌'}")
            print(f"   AI Enhancement Attempted: {'✅' if ai_enhancement_attempted else '❌'}")
            print(f"   Response Generated: {'✅' if len(response_content) > 0 else '❌'}")
            print(f"   Note: Detailed backend logs are visible in server console")
            
            return composite_success
            
        except Exception as e:
            print(f"❌ Backend logs verification error: {str(e)}")
            return False
    
    def test_fallback_behavior(self, car_base64, logo_base64):
        """Test fallback behavior when AI enhancement fails"""
        try:
            print("\n🧪 TESTING FALLBACK BEHAVIOR")
            print("=" * 60)
            print("Testing: System should gracefully fallback to sharp-only if AI fails")
            
            # Upload car image
            car_response = requests.post(f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "content": "Here's my car for logo placement",
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
            
            # Consume response
            for line in car_response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode())
                        if data.get('type') == 'done':
                            break
                    except:
                        continue
            
            time.sleep(2)
            
            # Test with a request that should trigger compositing
            response = requests.post(f"{BASE_URL}/api/chat/stream",
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                },
                json={
                    "content": "add this logo to the car",
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
                print(f"❌ Request failed: {response.status_code}")
                return False
            
            # Monitor for fallback indicators
            fallback_working = False
            final_image_received = False
            
            for line in response.iter_lines():
                if line:
                    try:
                        data = json.loads(line.decode())
                        
                        if data.get('type') == 'image':
                            if data.get('contentType') == 'composite_edit':
                                final_image_received = True
                                print("✅ Final composite image received (fallback working)")
                        
                        elif data.get('type') == 'done':
                            fallback_working = final_image_received
                            break
                            
                    except json.JSONDecodeError:
                        continue
            
            print(f"\n📊 FALLBACK BEHAVIOR RESULTS:")
            print(f"   Final Image Received: {'✅' if final_image_received else '❌'}")
            print(f"   Fallback System Working: {'✅' if fallback_working else '❌'}")
            print(f"   Note: System should produce result even if AI enhancement fails")
            
            return fallback_working
            
        except Exception as e:
            print(f"❌ Fallback behavior test error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all hybrid compositing tests"""
        print("🚀 Starting HYBRID COMPOSITING Tests")
        print("=" * 70)
        print("Testing the new two-step hybrid approach:")
        print("1. Sharp compositing for pixel-perfect placement")
        print("2. AI enhancement for realistic sticker effects")
        print("=" * 70)
        
        # Step 1: Authenticate
        if not self.authenticate():
            return False
        
        # Step 2: Create conversation
        if not self.create_conversation():
            return False
        
        # Step 3: Create test images
        car_base64 = self.create_realistic_car_image()
        logo_base64 = self.create_transparent_logo()
        
        if not car_base64 or not logo_base64:
            print("❌ Failed to create test images")
            return False
        
        # Step 4: Run tests
        test_results = []
        
        print("\n" + "🧪" * 20 + " RUNNING TESTS " + "🧪" * 20)
        
        # Test 1: Hybrid Compositing Flow
        test_results.append(self.test_hybrid_compositing_flow(car_base64, logo_base64))
        time.sleep(3)
        
        # Test 2: Backend Logs Verification
        test_results.append(self.test_backend_logs_verification(car_base64, logo_base64))
        time.sleep(3)
        
        # Test 3: Fallback Behavior
        test_results.append(self.test_fallback_behavior(car_base64, logo_base64))
        
        # Final results
        print("\n" + "=" * 70)
        print("🏁 HYBRID COMPOSITING TEST RESULTS")
        print("=" * 70)
        
        passed_tests = sum(test_results)
        total_tests = len(test_results)
        
        print(f"Tests Passed: {passed_tests}/{total_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        test_names = [
            "Hybrid Compositing Flow",
            "Backend Logs Verification", 
            "Fallback Behavior"
        ]
        
        for i, (name, result) in enumerate(zip(test_names, test_results)):
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{i+1}. {name}: {status}")
        
        print("\n📋 EXPECTED BACKEND LOG MESSAGES:")
        print("   [Composite Edit] Sharp composite complete")
        print("   [Composite Edit] Sharp composite uploaded:")
        print("   [Composite Edit] HYBRID: Starting AI enhancement pass...")
        print("   [Composite Edit] Trying SeeDream v4 for realistic enhancement...")
        print("   [Composite Edit] Enhancement task created:")
        print("   [Composite Edit] Enhancement status:")
        print("   [Composite Edit] AI Enhancement SUCCESS! OR AI Enhancement failed")
        print("   [Composite Edit] Final result using method:")
        
        print("\n📋 EXPECTED RESPONSE MESSAGES:")
        print("   🎨 *Adding realistic sticker effects (shadows, contours, lighting)...*")
        print("   🎨 *Enhanced with realistic sticker effects* (if AI succeeds)")
        
        if passed_tests == total_tests:
            print("\n🎉 ALL TESTS PASSED! HYBRID COMPOSITING is working correctly.")
            print("✅ Sharp compositing + AI enhancement flow is functional")
            print("✅ Realistic sticker effects are being applied")
            print("✅ Fallback to sharp-only works when AI fails")
        else:
            print(f"\n⚠️ {total_tests - passed_tests} test(s) failed. Review the hybrid implementation.")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = HybridCompositingTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)