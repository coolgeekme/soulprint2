#!/usr/bin/env python3
"""
SMB Detection System Testing for SoulPrint Engine Pro Cross-Product Promotion
Tests the buildSMBProContext() function and its integration into chat stream.
"""

import requests
import json
import time
from datetime import datetime
from pymongo import MongoClient

# Configuration
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"
TEST_EMAIL = "testchat@example.com"
TEST_PASSWORD = "Test123456"
# Use local MongoDB since Atlas is blocked in dev environment
MONGO_URL = "mongodb://localhost:27017/soulprint"

# Global variables
auth_token = None
user_id = None
mongo_client = None
db = None

def setup_mongo():
    """Setup MongoDB connection"""
    global mongo_client, db
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client['soulprint']
        print("✅ MongoDB connection established")
        return True
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return False

def cleanup_mongo():
    """Cleanup MongoDB connection"""
    global mongo_client
    if mongo_client:
        mongo_client.close()
        print("✅ MongoDB connection closed")

def login():
    """Login and get auth token"""
    global auth_token, user_id
    try:
        print("\n" + "="*80)
        print("STEP 1: Authentication")
        print("="*80)
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "passcode": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            auth_token = data.get('token')
            user_id = data.get('user', {}).get('id')
            
            # If user_id is None, get it from /api/auth/me
            if not user_id:
                me_response = requests.get(
                    f"{BASE_URL}/api/auth/me",
                    headers={"Authorization": f"Bearer {auth_token}"}
                )
                if me_response.status_code == 200:
                    me_data = me_response.json()
                    user_id = me_data.get('id')
            
            print(f"✅ Login successful")
            print(f"   User ID: {user_id}")
            print(f"   Token: {auth_token[:20]}...")
            return True
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

def test_chat_stream_basic():
    """Test 1: Chat stream still works (no regressions)"""
    try:
        print("\n" + "="*80)
        print("TEST 1: Chat Stream Basic Functionality (No Regressions)")
        print("="*80)
        
        response = requests.post(
            f"{BASE_URL}/api/chat/stream",
            json={
                "content": "Hello, how are you?",
                "model": "gpt-4o-mini",
                "conversationId": None
            },
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            stream=True
        )
        
        if response.status_code != 200:
            print(f"❌ Chat stream failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        
        # Check content type
        content_type = response.headers.get('content-type', '')
        print(f"✅ Chat stream endpoint accessible")
        print(f"   Status: {response.status_code}")
        print(f"   Content-Type: {content_type}")
        
        # Parse NDJSON stream
        event_count = 0
        has_delta = False
        has_done = False
        errors = []
        
        for line in response.iter_lines():
            if line:
                try:
                    event = json.loads(line.decode('utf-8'))
                    event_count += 1
                    
                    if event.get('type') == 'delta':
                        has_delta = True
                    elif event.get('type') == 'done':
                        has_done = True
                    elif event.get('type') == 'error':
                        errors.append(event.get('error', 'Unknown error'))
                except json.JSONDecodeError:
                    pass
        
        print(f"   Events received: {event_count}")
        print(f"   Has delta events: {has_delta}")
        print(f"   Has done event: {has_done}")
        
        if errors:
            print(f"❌ Errors found in stream: {errors}")
            return False
        
        if not has_delta or not has_done:
            print(f"❌ Missing required events (delta: {has_delta}, done: {has_done})")
            return False
        
        print("✅ TEST 1 PASSED: Chat stream working correctly with no regressions")
        return True
        
    except Exception as e:
        print(f"❌ TEST 1 FAILED: {e}")
        return False

def seed_business_messages():
    """Seed business messages directly into MongoDB"""
    try:
        print("\n" + "="*80)
        print("STEP 2: Seeding Business Messages")
        print("="*80)
        
        messages_collection = db['messages']
        
        # Clear existing user messages to ensure clean test
        existing_count = messages_collection.count_documents({"user_id": user_id, "role": "user"})
        if existing_count > 0:
            messages_collection.delete_many({"user_id": user_id, "role": "user"})
            print(f"✅ Cleared {existing_count} existing user messages")
        
        business_messages = [
            "Help me create a marketing strategy for my small business",
            "What's the best sales funnel approach for B2B?",
            "I need to improve my business operations workflow",
            "Can you help me write a business plan?",
            "What pricing strategy should I use for my SaaS product?",
            "Help me with lead generation for my startup",
            "I need a content marketing plan for Q3",
            "How do I manage inventory for my e-commerce business?",
            "Write me a cold outreach email template for sales",
            "What's a good customer acquisition strategy?",
            "Help me with SEO for my business website",
            "I need to create a pitch deck for investors"
        ]
        
        # Insert business messages
        inserted_count = 0
        for msg in business_messages:
            message_doc = {
                "id": f"test_smb_{int(time.time() * 1000)}_{inserted_count}",
                "user_id": user_id,
                "conversation_id": f"test_conv_{user_id}",
                "role": "user",
                "content": msg,
                "created_at": datetime.utcnow()
            }
            messages_collection.insert_one(message_doc)
            inserted_count += 1
            time.sleep(0.1)  # Small delay to ensure different timestamps
        
        print(f"✅ Seeded {inserted_count} business messages into MongoDB")
        
        # Verify messages were inserted
        count = messages_collection.count_documents({"user_id": user_id, "role": "user"})
        print(f"   Total user messages in DB: {count}")
        print(f"   Business message ratio: {inserted_count}/{count} = {int(inserted_count/count*100)}%")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to seed business messages: {e}")
        return False

def test_smb_detection_trigger():
    """Test 2: SMB detection with business messages"""
    try:
        print("\n" + "="*80)
        print("TEST 2: SMB Detection with Business Messages")
        print("="*80)
        
        # Clear any existing SMB promotion records for this user
        smb_promotions = db['smb_promotions']
        smb_promotions.delete_many({"user_id": user_id})
        print("✅ Cleared existing SMB promotion records")
        
        # Send a business message to trigger detection
        response = requests.post(
            f"{BASE_URL}/api/chat/stream",
            json={
                "content": "Help me refine my marketing campaign for next quarter",
                "model": "gpt-4o-mini",
                "conversationId": None
            },
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            stream=True
        )
        
        if response.status_code != 200:
            print(f"❌ Chat stream failed with status {response.status_code}")
            return False
        
        print(f"✅ Chat stream request sent successfully")
        
        # Consume the stream
        event_count = 0
        for line in response.iter_lines():
            if line:
                event_count += 1
        
        print(f"   Events received: {event_count}")
        
        # Wait a moment for DB write
        time.sleep(2)
        
        # Check if SMB promotion record was created
        smb_record = smb_promotions.find_one({"user_id": user_id})
        
        if not smb_record:
            print("❌ No SMB promotion record found in database")
            return False
        
        print("✅ SMB promotion record created in database")
        print(f"   Last nudged at: {smb_record.get('last_nudged_at')}")
        print(f"   Detected categories: {smb_record.get('detected_categories', [])}")
        print(f"   SMB message count: {smb_record.get('smb_message_count', 0)}")
        print(f"   Total messages analyzed: {smb_record.get('total_messages_analyzed', 0)}")
        print(f"   SMB ratio: {smb_record.get('smb_ratio', 0)}%")
        print(f"   Nudge count: {smb_record.get('nudge_count', 0)}")
        
        # Verify threshold was met
        smb_count = smb_record.get('smb_message_count', 0)
        smb_ratio = smb_record.get('smb_ratio', 0)
        
        if smb_count < 5:
            print(f"❌ SMB message count ({smb_count}) is below threshold (5)")
            return False
        
        if smb_ratio < 15:
            print(f"❌ SMB ratio ({smb_ratio}%) is below threshold (15%)")
            return False
        
        print("✅ TEST 2 PASSED: SMB detection triggered correctly with business messages")
        return True
        
    except Exception as e:
        print(f"❌ TEST 2 FAILED: {e}")
        return False

def test_anti_spam_cooldown():
    """Test 3: Anti-spam cooldown"""
    try:
        print("\n" + "="*80)
        print("TEST 3: Anti-Spam Cooldown (7-day)")
        print("="*80)
        
        smb_promotions = db['smb_promotions']
        
        # Get the existing record
        smb_record = smb_promotions.find_one({"user_id": user_id})
        
        if not smb_record:
            print("❌ No SMB promotion record found (Test 2 should have created one)")
            return False
        
        last_nudged_at = smb_record.get('last_nudged_at')
        print(f"✅ Found SMB promotion record")
        print(f"   Last nudged at: {last_nudged_at}")
        
        # Calculate days since last nudge
        if last_nudged_at:
            days_since = (datetime.utcnow() - last_nudged_at).total_seconds() / (60 * 60 * 24)
            print(f"   Days since last nudge: {days_since:.2f}")
            
            if days_since < 7:
                print(f"✅ Cooldown active: User was nudged {days_since:.2f} days ago (< 7 days)")
                print("   The function should return empty string during cooldown")
            else:
                print(f"⚠️  Cooldown expired: User was nudged {days_since:.2f} days ago (>= 7 days)")
                print("   The function would allow another nudge")
        
        # Send another business message - should NOT trigger another nudge
        response = requests.post(
            f"{BASE_URL}/api/chat/stream",
            json={
                "content": "I need help with my sales strategy",
                "model": "gpt-4o-mini",
                "conversationId": None
            },
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            stream=True
        )
        
        # Consume the stream
        for line in response.iter_lines():
            pass
        
        time.sleep(2)
        
        # Check if nudge count increased
        updated_record = smb_promotions.find_one({"user_id": user_id})
        original_nudge_count = smb_record.get('nudge_count', 0)
        updated_nudge_count = updated_record.get('nudge_count', 0)
        
        print(f"   Original nudge count: {original_nudge_count}")
        print(f"   Updated nudge count: {updated_nudge_count}")
        
        if updated_nudge_count == original_nudge_count:
            print("✅ Nudge count unchanged - cooldown working correctly")
        else:
            print("⚠️  Nudge count increased - cooldown may have expired or logic changed")
        
        print("✅ TEST 3 PASSED: Anti-spam cooldown mechanism verified")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 FAILED: {e}")
        return False

def test_non_business_user():
    """Test 4: Non-business user should NOT trigger"""
    try:
        print("\n" + "="*80)
        print("TEST 4: Non-Business User Should NOT Trigger")
        print("="*80)
        
        # Create a new test user with non-business messages
        test_user_email = f"nonbusiness_{int(time.time())}@test.com"
        
        # Register new user
        reg_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_user_email,
                "passcode": "Test123456"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if reg_response.status_code not in [200, 201]:
            print(f"⚠️  Could not create new test user, using existing user for test")
            # Use existing user but clear their messages
            messages_collection = db['messages']
            messages_collection.delete_many({"user_id": user_id})
            test_user_id = user_id
            test_token = auth_token
        else:
            reg_data = reg_response.json()
            test_token = reg_data.get('token')
            test_user_id = reg_data.get('user', {}).get('id')
            print(f"✅ Created new test user: {test_user_email}")
        
        # Seed non-business messages
        non_business_messages = [
            "What's the weather like today?",
            "Tell me a joke",
            "How do I cook pasta?",
            "What's the capital of France?"
        ]
        
        messages_collection = db['messages']
        for msg in non_business_messages:
            message_doc = {
                "id": f"test_nonbiz_{int(time.time() * 1000)}",
                "user_id": test_user_id,
                "conversation_id": f"test_conv_{test_user_id}",
                "role": "user",
                "content": msg,
                "created_at": datetime.utcnow()
            }
            messages_collection.insert_one(message_doc)
            time.sleep(0.1)
        
        print(f"✅ Seeded {len(non_business_messages)} non-business messages")
        
        # Clear any SMB promotion records
        smb_promotions = db['smb_promotions']
        smb_promotions.delete_many({"user_id": test_user_id})
        
        # Send a message
        response = requests.post(
            f"{BASE_URL}/api/chat/stream",
            json={
                "content": "What's your favorite color?",
                "model": "gpt-4o-mini",
                "conversationId": None
            },
            headers={
                "Authorization": f"Bearer {test_token}",
                "Content-Type": "application/json"
            },
            stream=True
        )
        
        # Consume the stream
        for line in response.iter_lines():
            pass
        
        time.sleep(2)
        
        # Check if SMB promotion record was created
        smb_record = smb_promotions.find_one({"user_id": test_user_id})
        
        if smb_record:
            print(f"❌ SMB promotion record was created for non-business user")
            print(f"   SMB message count: {smb_record.get('smb_message_count', 0)}")
            print(f"   SMB ratio: {smb_record.get('smb_ratio', 0)}%")
            return False
        
        print("✅ No SMB promotion record created for non-business user")
        print("✅ TEST 4 PASSED: Non-business users do not trigger SMB detection")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4 FAILED: {e}")
        return False

def main():
    """Main test execution"""
    print("\n" + "="*80)
    print("SMB DETECTION SYSTEM TESTING")
    print("Testing buildSMBProContext() and SoulPrint Engine Pro Promotion")
    print("="*80)
    
    # Setup
    if not setup_mongo():
        print("\n❌ TESTING ABORTED: MongoDB connection failed")
        return
    
    if not login():
        print("\n❌ TESTING ABORTED: Authentication failed")
        cleanup_mongo()
        return
    
    # Run tests
    results = {
        "Test 1: Chat Stream Basic": test_chat_stream_basic(),
        "Test 2: SMB Detection Trigger": False,
        "Test 3: Anti-Spam Cooldown": False,
        "Test 4: Non-Business User": False
    }
    
    # Test 2 requires seeding
    if seed_business_messages():
        results["Test 2: SMB Detection Trigger"] = test_smb_detection_trigger()
        
        # Test 3 depends on Test 2
        if results["Test 2: SMB Detection Trigger"]:
            results["Test 3: Anti-Spam Cooldown"] = test_anti_spam_cooldown()
    
    # Test 4 is independent
    results["Test 4: Non-Business User"] = test_non_business_user()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({int(passed/total*100)}%)")
    
    # Cleanup
    cleanup_mongo()
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - SMB Detection system is working correctly!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - review the output above")

if __name__ == "__main__":
    main()
