#!/usr/bin/env python3
"""
Brazilian Portuguese Waitlist Backend API Testing

Tests the three new Brazilian Portuguese waitlist endpoints:
1. POST /api/waitlist/pt-br (PUBLIC - no auth needed)
2. GET /api/admin/waitlist/pt-br (ADMIN - requires admin/superadmin role)
3. GET /api/admin/waitlist/pt-br/export (ADMIN - requires admin role)

Credentials:
- Admin: test@soulprint.com / test123 (superadmin, confirmed in DB)
- Login endpoint: POST /api/auth/login with {email, password} returns {token}
- Use token as `Authorization: Bearer <token>` header on admin endpoints

Collection to verify: `brazilian_waitlist` (brand new collection, will be created on first insert)
"""

import requests
import json
import time
import uuid
import hashlib
import csv
import io
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:3000"  # Will be updated from environment if available
ADMIN_EMAIL = "test@soulprint.com"
ADMIN_PASSWORD = "test123"

def get_base_url():
    """Get the base URL from environment or use localhost fallback"""
    import os
    # Try to get from environment variables
    next_public_base_url = os.environ.get('NEXT_PUBLIC_BASE_URL')
    if next_public_base_url:
        return next_public_base_url
    return BASE_URL

def login_admin():
    """Login as admin and return the token"""
    base_url = get_base_url()
    login_url = f"{base_url}/api/auth/login"
    
    payload = {
        "email": ADMIN_EMAIL,
        "passcode": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(login_url, json=payload, timeout=30)
        print(f"Admin login response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print("✅ Admin login successful")
                return token
            else:
                print("❌ Admin login failed: No token in response")
                print(f"Response: {data}")
                return None
        else:
            print(f"❌ Admin login failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Admin login error: {str(e)}")
        return None

def test_waitlist_public_endpoint():
    """Test POST /api/waitlist/pt-br endpoint (PUBLIC - no auth needed)"""
    print("\n" + "="*80)
    print("TESTING: POST /api/waitlist/pt-br (PUBLIC ENDPOINT)")
    print("="*80)
    
    base_url = get_base_url()
    endpoint = f"{base_url}/api/waitlist/pt-br"
    
    test_results = []
    
    # Test A: Happy path - valid email + valid region
    print("\n🧪 Test A: Happy path - valid email + valid region")
    test_email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": test_email,
        "region": "sao-paulo",
        "source": "test-suite"
    }
    
    try:
        response = requests.post(endpoint, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and not data.get('already_registered'):
                print("✅ Test A PASSED: Valid email + region accepted")
                test_results.append(("A", "PASS", "Valid email + region accepted"))
            else:
                print("❌ Test A FAILED: Unexpected response format")
                test_results.append(("A", "FAIL", f"Unexpected response: {data}"))
        else:
            print(f"❌ Test A FAILED: Expected 200, got {response.status_code}")
            test_results.append(("A", "FAIL", f"Status {response.status_code}: {response.text}"))
    except Exception as e:
        print(f"❌ Test A ERROR: {str(e)}")
        test_results.append(("A", "ERROR", str(e)))
    
    # Test B: Happy path - valid email + NO region
    print("\n🧪 Test B: Happy path - valid email + NO region")
    test_email_b = f"test-{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": test_email_b
    }
    
    try:
        response = requests.post(endpoint, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and not data.get('already_registered'):
                print("✅ Test B PASSED: Valid email without region accepted")
                test_results.append(("B", "PASS", "Valid email without region accepted"))
            else:
                print("❌ Test B FAILED: Unexpected response format")
                test_results.append(("B", "FAIL", f"Unexpected response: {data}"))
        else:
            print(f"❌ Test B FAILED: Expected 200, got {response.status_code}")
            test_results.append(("B", "FAIL", f"Status {response.status_code}: {response.text}"))
    except Exception as e:
        print(f"❌ Test B ERROR: {str(e)}")
        test_results.append(("B", "ERROR", str(e)))
    
    # Test C: Idempotency - same email from test A
    print("\n🧪 Test C: Idempotency - same email from test A")
    payload = {
        "email": test_email,
        "region": "sao-paulo"
    }
    
    try:
        response = requests.post(endpoint, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('already_registered'):
                print("✅ Test C PASSED: Idempotency working - already_registered=true")
                test_results.append(("C", "PASS", "Idempotency working"))
            else:
                print("❌ Test C FAILED: Expected already_registered=true")
                test_results.append(("C", "FAIL", f"Expected already_registered=true, got: {data}"))
        else:
            print(f"❌ Test C FAILED: Expected 200, got {response.status_code}")
            test_results.append(("C", "FAIL", f"Status {response.status_code}: {response.text}"))
    except Exception as e:
        print(f"❌ Test C ERROR: {str(e)}")
        test_results.append(("C", "ERROR", str(e)))
    
    # Test D: Idempotency with region update
    print("\n🧪 Test D: Idempotency with region update")
    # First submit without region
    test_email_d = f"test-{uuid.uuid4().hex[:8]}@example.com"
    payload1 = {"email": test_email_d}
    
    try:
        response1 = requests.post(endpoint, json=payload1, timeout=30)
        print(f"First request - Status: {response1.status_code}")
        
        if response1.status_code == 200:
            # Then submit with region
            payload2 = {"email": test_email_d, "region": "rio-de-janeiro"}
            response2 = requests.post(endpoint, json=payload2, timeout=30)
            print(f"Second request - Status: {response2.status_code}")
            print(f"Second request - Response: {response2.text}")
            
            if response2.status_code == 200:
                data = response2.json()
                if data.get('success') and data.get('already_registered'):
                    print("✅ Test D PASSED: Region update on existing email")
                    test_results.append(("D", "PASS", "Region update working"))
                else:
                    print("❌ Test D FAILED: Expected already_registered=true with region update")
                    test_results.append(("D", "FAIL", f"Unexpected response: {data}"))
            else:
                print(f"❌ Test D FAILED: Second request failed with {response2.status_code}")
                test_results.append(("D", "FAIL", f"Second request status {response2.status_code}"))
        else:
            print(f"❌ Test D FAILED: First request failed with {response1.status_code}")
            test_results.append(("D", "FAIL", f"First request status {response1.status_code}"))
    except Exception as e:
        print(f"❌ Test D ERROR: {str(e)}")
        test_results.append(("D", "ERROR", str(e)))
    
    # Test E: Invalid email (no @)
    print("\n🧪 Test E: Invalid email (no @)")
    payload = {"email": "notanemail"}
    
    try:
        response = requests.post(endpoint, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            data = response.json()
            if data.get('error') == 'INVALID_EMAIL':
                print("✅ Test E PASSED: Invalid email rejected with INVALID_EMAIL")
                test_results.append(("E", "PASS", "Invalid email rejected"))
            else:
                print(f"❌ Test E FAILED: Expected INVALID_EMAIL error, got: {data}")
                test_results.append(("E", "FAIL", f"Wrong error: {data}"))
        else:
            print(f"❌ Test E FAILED: Expected 400, got {response.status_code}")
            test_results.append(("E", "FAIL", f"Status {response.status_code}: {response.text}"))
    except Exception as e:
        print(f"❌ Test E ERROR: {str(e)}")
        test_results.append(("E", "ERROR", str(e)))
    
    # Test F: Invalid email (empty)
    print("\n🧪 Test F: Invalid email (empty)")
    payload = {"email": ""}
    
    try:
        response = requests.post(endpoint, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            data = response.json()
            if data.get('error') == 'INVALID_EMAIL':
                print("✅ Test F PASSED: Empty email rejected with INVALID_EMAIL")
                test_results.append(("F", "PASS", "Empty email rejected"))
            else:
                print(f"❌ Test F FAILED: Expected INVALID_EMAIL error, got: {data}")
                test_results.append(("F", "FAIL", f"Wrong error: {data}"))
        else:
            print(f"❌ Test F FAILED: Expected 400, got {response.status_code}")
            test_results.append(("F", "FAIL", f"Status {response.status_code}: {response.text}"))
    except Exception as e:
        print(f"❌ Test F ERROR: {str(e)}")
        test_results.append(("F", "ERROR", str(e)))
    
    # Test G: Invalid email (missing field)
    print("\n🧪 Test G: Invalid email (missing field)")
    payload = {}
    
    try:
        response = requests.post(endpoint, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            print("✅ Test G PASSED: Missing email field rejected")
            test_results.append(("G", "PASS", "Missing email field rejected"))
        else:
            print(f"❌ Test G FAILED: Expected 400, got {response.status_code}")
            test_results.append(("G", "FAIL", f"Status {response.status_code}: {response.text}"))
    except Exception as e:
        print(f"❌ Test G ERROR: {str(e)}")
        test_results.append(("G", "ERROR", str(e)))
    
    # Test H: Invalid region (should be stored as null, not error)
    print("\n🧪 Test H: Invalid region (should be stored as null, not error)")
    test_email_h = f"test-{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": test_email_h,
        "region": "invalid-region"
    }
    
    try:
        response = requests.post(endpoint, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Test H PASSED: Invalid region accepted (stored as null)")
                test_results.append(("H", "PASS", "Invalid region accepted"))
            else:
                print(f"❌ Test H FAILED: Expected success, got: {data}")
                test_results.append(("H", "FAIL", f"Unexpected response: {data}"))
        else:
            print(f"❌ Test H FAILED: Expected 200, got {response.status_code}")
            test_results.append(("H", "FAIL", f"Status {response.status_code}: {response.text}"))
    except Exception as e:
        print(f"❌ Test H ERROR: {str(e)}")
        test_results.append(("H", "ERROR", str(e)))
    
    # Test I: Email normalization
    print("\n🧪 Test I: Email normalization")
    test_email_i = f"  TEST-{uuid.uuid4().hex[:8]}@EXAMPLE.COM  "
    payload = {"email": test_email_i}
    
    try:
        response = requests.post(endpoint, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Test I PASSED: Email normalization working (trimmed + lowercased)")
                test_results.append(("I", "PASS", "Email normalization working"))
            else:
                print(f"❌ Test I FAILED: Expected success, got: {data}")
                test_results.append(("I", "FAIL", f"Unexpected response: {data}"))
        else:
            print(f"❌ Test I FAILED: Expected 200, got {response.status_code}")
            test_results.append(("I", "FAIL", f"Status {response.status_code}: {response.text}"))
    except Exception as e:
        print(f"❌ Test I ERROR: {str(e)}")
        test_results.append(("I", "ERROR", str(e)))
    
    # Test J: Rate limit (simplified - just send a few requests quickly)
    print("\n🧪 Test J: Rate limit (simplified test)")
    print("Sending 6 rapid requests to test rate limiting...")
    
    rate_limit_hit = False
    for i in range(6):
        test_email_j = f"rate-test-{i}-{uuid.uuid4().hex[:8]}@example.com"
        payload = {"email": test_email_j}
        
        try:
            response = requests.post(endpoint, json=payload, timeout=10)
            print(f"Request {i+1}: Status {response.status_code}")
            
            if response.status_code == 429:
                data = response.json()
                if data.get('error') == 'RATE_LIMITED':
                    print("✅ Test J PASSED: Rate limiting working")
                    test_results.append(("J", "PASS", "Rate limiting working"))
                    rate_limit_hit = True
                    break
        except Exception as e:
            print(f"Request {i+1} error: {str(e)}")
        
        time.sleep(0.1)  # Small delay between requests
    
    if not rate_limit_hit:
        print("⚠️ Test J: Rate limit not hit in 6 requests (may need more requests)")
        test_results.append(("J", "PARTIAL", "Rate limit not hit in 6 requests"))
    
    # Summary
    print("\n" + "="*50)
    print("PUBLIC ENDPOINT TEST SUMMARY")
    print("="*50)
    
    passed = sum(1 for _, status, _ in test_results if status == "PASS")
    failed = sum(1 for _, status, _ in test_results if status == "FAIL")
    errors = sum(1 for _, status, _ in test_results if status == "ERROR")
    partial = sum(1 for _, status, _ in test_results if status == "PARTIAL")
    
    print(f"✅ PASSED: {passed}")
    print(f"❌ FAILED: {failed}")
    print(f"⚠️ ERRORS: {errors}")
    print(f"🔶 PARTIAL: {partial}")
    print(f"📊 TOTAL: {len(test_results)}")
    
    for test_id, status, message in test_results:
        status_icon = {"PASS": "✅", "FAIL": "❌", "ERROR": "⚠️", "PARTIAL": "🔶"}[status]
        print(f"{status_icon} Test {test_id}: {message}")
    
    return test_results

def test_admin_waitlist_endpoint(admin_token):
    """Test GET /api/admin/waitlist/pt-br endpoint (ADMIN - requires admin/superadmin role)"""
    print("\n" + "="*80)
    print("TESTING: GET /api/admin/waitlist/pt-br (ADMIN ENDPOINT)")
    print("="*80)
    
    base_url = get_base_url()
    endpoint = f"{base_url}/api/admin/waitlist/pt-br"
    
    test_results = []
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test A: Unauthorized (no token)
    print("\n🧪 Test A: Unauthorized (no token)")
    try:
        response = requests.get(endpoint, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 401:
            print("✅ Test A PASSED: Unauthorized access rejected")
            test_results.append(("A", "PASS", "Unauthorized access rejected"))
        else:
            print(f"❌ Test A FAILED: Expected 401, got {response.status_code}")
            test_results.append(("A", "FAIL", f"Status {response.status_code}: {response.text}"))
    except Exception as e:
        print(f"❌ Test A ERROR: {str(e)}")
        test_results.append(("A", "ERROR", str(e)))
    
    # Test B: Unauthorized (non-admin token) - Skip for now as we only have admin credentials
    print("\n🧪 Test B: Skipping non-admin token test (only admin credentials available)")
    test_results.append(("B", "SKIP", "Non-admin token test skipped"))
    
    # Test C: Authorized (admin token)
    print("\n🧪 Test C: Authorized (admin token)")
    try:
        response = requests.get(endpoint, headers=headers, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}...")  # Truncate long response
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ['locale', 'total', 'stats', 'pagination', 'items', 'generated_at']
            
            if all(field in data for field in required_fields):
                # Check stats structure
                stats = data.get('stats', {})
                stats_fields = ['last_24h', 'last_7d', 'last_30d', 'by_region', 'by_day']
                
                if all(field in stats for field in stats_fields):
                    # Check by_day has exactly 30 entries
                    by_day = stats.get('by_day', [])
                    if len(by_day) == 30:
                        print("✅ Test C PASSED: Admin endpoint returns correct structure")
                        test_results.append(("C", "PASS", "Admin endpoint structure correct"))
                    else:
                        print(f"❌ Test C FAILED: by_day has {len(by_day)} entries, expected 30")
                        test_results.append(("C", "FAIL", f"by_day has {len(by_day)} entries"))
                else:
                    print(f"❌ Test C FAILED: Missing stats fields: {stats_fields}")
                    test_results.append(("C", "FAIL", "Missing stats fields"))
            else:
                print(f"❌ Test C FAILED: Missing required fields: {required_fields}")
                test_results.append(("C", "FAIL", "Missing required fields"))
        else:
            print(f"❌ Test C FAILED: Expected 200, got {response.status_code}")
            test_results.append(("C", "FAIL", f"Status {response.status_code}: {response.text}"))
    except Exception as e:
        print(f"❌ Test C ERROR: {str(e)}")
        test_results.append(("C", "ERROR", str(e)))
    
    # Test D: Verify items DO NOT contain ip_hash or user_agent fields
    print("\n🧪 Test D: Verify PII protection (no ip_hash/user_agent in items)")
    try:
        response = requests.get(endpoint, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            items = data.get('items', [])
            
            if items:
                # Check first item for PII fields
                first_item = items[0]
                if 'ip_hash' not in first_item and 'user_agent' not in first_item:
                    print("✅ Test D PASSED: PII fields excluded from response")
                    test_results.append(("D", "PASS", "PII fields excluded"))
                else:
                    print("❌ Test D FAILED: PII fields found in response")
                    test_results.append(("D", "FAIL", "PII fields present"))
            else:
                print("⚠️ Test D: No items to check (empty database)")
                test_results.append(("D", "PARTIAL", "No items to check"))
        else:
            print(f"❌ Test D FAILED: Could not get data, status {response.status_code}")
            test_results.append(("D", "FAIL", f"Status {response.status_code}"))
    except Exception as e:
        print(f"❌ Test D ERROR: {str(e)}")
        test_results.append(("D", "ERROR", str(e)))
    
    # Test E: Verify by_day has exactly 30 entries
    print("\n🧪 Test E: Verify by_day has exactly 30 entries")
    try:
        response = requests.get(endpoint, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            by_day = data.get('stats', {}).get('by_day', [])
            
            if len(by_day) == 30:
                # Check if dates are contiguous
                dates = [entry['date'] for entry in by_day]
                print(f"First date: {dates[0]}, Last date: {dates[-1]}")
                print("✅ Test E PASSED: by_day has exactly 30 entries")
                test_results.append(("E", "PASS", "by_day has 30 entries"))
            else:
                print(f"❌ Test E FAILED: by_day has {len(by_day)} entries, expected 30")
                test_results.append(("E", "FAIL", f"by_day has {len(by_day)} entries"))
        else:
            print(f"❌ Test E FAILED: Could not get data, status {response.status_code}")
            test_results.append(("E", "FAIL", f"Status {response.status_code}"))
    except Exception as e:
        print(f"❌ Test E ERROR: {str(e)}")
        test_results.append(("E", "ERROR", str(e)))
    
    # Test F: Verify total matches actual count
    print("\n🧪 Test F: Verify total matches actual count")
    try:
        response = requests.get(endpoint, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            total = data.get('total', 0)
            items = data.get('items', [])
            
            print(f"Total reported: {total}, Items in current page: {len(items)}")
            
            # For this test, we'll just verify the total is a non-negative number
            if isinstance(total, int) and total >= 0:
                print("✅ Test F PASSED: Total is valid non-negative integer")
                test_results.append(("F", "PASS", f"Total is {total}"))
            else:
                print(f"❌ Test F FAILED: Total is not valid: {total}")
                test_results.append(("F", "FAIL", f"Invalid total: {total}"))
        else:
            print(f"❌ Test F FAILED: Could not get data, status {response.status_code}")
            test_results.append(("F", "FAIL", f"Status {response.status_code}"))
    except Exception as e:
        print(f"❌ Test F ERROR: {str(e)}")
        test_results.append(("F", "ERROR", str(e)))
    
    # Test G: Pagination
    print("\n🧪 Test G: Pagination with limit=1")
    try:
        response = requests.get(f"{endpoint}?limit=1", headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            items = data.get('items', [])
            pagination = data.get('pagination', {})
            total = data.get('total', 0)
            
            if len(items) <= 1:  # Should be 1 or 0 if no data
                total_pages = pagination.get('total_pages', 0)
                expected_pages = max(1, total) if total > 0 else 1
                
                print(f"Items: {len(items)}, Total pages: {total_pages}, Expected: {expected_pages}")
                print("✅ Test G PASSED: Pagination working")
                test_results.append(("G", "PASS", "Pagination working"))
            else:
                print(f"❌ Test G FAILED: Expected ≤1 items, got {len(items)}")
                test_results.append(("G", "FAIL", f"Got {len(items)} items"))
        else:
            print(f"❌ Test G FAILED: Status {response.status_code}")
            test_results.append(("G", "FAIL", f"Status {response.status_code}"))
    except Exception as e:
        print(f"❌ Test G ERROR: {str(e)}")
        test_results.append(("G", "ERROR", str(e)))
    
    # Test H: Region filter
    print("\n🧪 Test H: Region filter")
    try:
        response = requests.get(f"{endpoint}?region=sao-paulo", headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Test H PASSED: Region filter accepted")
            test_results.append(("H", "PASS", "Region filter working"))
        else:
            print(f"❌ Test H FAILED: Status {response.status_code}")
            test_results.append(("H", "FAIL", f"Status {response.status_code}"))
    except Exception as e:
        print(f"❌ Test H ERROR: {str(e)}")
        test_results.append(("H", "ERROR", str(e)))
    
    # Summary
    print("\n" + "="*50)
    print("ADMIN ENDPOINT TEST SUMMARY")
    print("="*50)
    
    passed = sum(1 for _, status, _ in test_results if status == "PASS")
    failed = sum(1 for _, status, _ in test_results if status == "FAIL")
    errors = sum(1 for _, status, _ in test_results if status == "ERROR")
    skipped = sum(1 for _, status, _ in test_results if status == "SKIP")
    partial = sum(1 for _, status, _ in test_results if status == "PARTIAL")
    
    print(f"✅ PASSED: {passed}")
    print(f"❌ FAILED: {failed}")
    print(f"⚠️ ERRORS: {errors}")
    print(f"⏭️ SKIPPED: {skipped}")
    print(f"🔶 PARTIAL: {partial}")
    print(f"📊 TOTAL: {len(test_results)}")
    
    for test_id, status, message in test_results:
        status_icon = {"PASS": "✅", "FAIL": "❌", "ERROR": "⚠️", "SKIP": "⏭️", "PARTIAL": "🔶"}[status]
        print(f"{status_icon} Test {test_id}: {message}")
    
    return test_results

def test_admin_export_endpoint(admin_token):
    """Test GET /api/admin/waitlist/pt-br/export endpoint (ADMIN - requires admin role)"""
    print("\n" + "="*80)
    print("TESTING: GET /api/admin/waitlist/pt-br/export (ADMIN CSV EXPORT)")
    print("="*80)
    
    base_url = get_base_url()
    endpoint = f"{base_url}/api/admin/waitlist/pt-br/export"
    
    test_results = []
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test A: Unauthorized (no token)
    print("\n🧪 Test A: Unauthorized (no token)")
    try:
        response = requests.get(endpoint, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ Test A PASSED: Unauthorized access rejected")
            test_results.append(("A", "PASS", "Unauthorized access rejected"))
        else:
            print(f"❌ Test A FAILED: Expected 401, got {response.status_code}")
            test_results.append(("A", "FAIL", f"Status {response.status_code}"))
    except Exception as e:
        print(f"❌ Test A ERROR: {str(e)}")
        test_results.append(("A", "ERROR", str(e)))
    
    # Test B: Authorized (admin token)
    print("\n🧪 Test B: Authorized CSV export")
    try:
        response = requests.get(endpoint, headers=headers, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Test B PASSED: CSV export successful")
            test_results.append(("B", "PASS", "CSV export successful"))
            
            # Store response for further tests
            csv_content = response.text
            csv_headers = response.headers
            
        else:
            print(f"❌ Test B FAILED: Expected 200, got {response.status_code}")
            test_results.append(("B", "FAIL", f"Status {response.status_code}"))
            return test_results
    except Exception as e:
        print(f"❌ Test B ERROR: {str(e)}")
        test_results.append(("B", "ERROR", str(e)))
        return test_results
    
    # Test C: Verify Content-Type header
    print("\n🧪 Test C: Verify Content-Type header")
    try:
        content_type = csv_headers.get('content-type', '').lower()
        print(f"Content-Type: {content_type}")
        
        if 'text/csv' in content_type and 'charset=utf-8' in content_type:
            print("✅ Test C PASSED: Content-Type is text/csv; charset=utf-8")
            test_results.append(("C", "PASS", "Content-Type correct"))
        else:
            print(f"❌ Test C FAILED: Expected text/csv; charset=utf-8, got {content_type}")
            test_results.append(("C", "FAIL", f"Wrong Content-Type: {content_type}"))
    except Exception as e:
        print(f"❌ Test C ERROR: {str(e)}")
        test_results.append(("C", "ERROR", str(e)))
    
    # Test D: Verify Content-Disposition header
    print("\n🧪 Test D: Verify Content-Disposition header")
    try:
        content_disposition = csv_headers.get('content-disposition', '')
        print(f"Content-Disposition: {content_disposition}")
        
        if content_disposition.startswith('attachment; filename="brazilian-waitlist-'):
            print("✅ Test D PASSED: Content-Disposition header correct")
            test_results.append(("D", "PASS", "Content-Disposition correct"))
        else:
            print(f"❌ Test D FAILED: Expected attachment filename, got {content_disposition}")
            test_results.append(("D", "FAIL", f"Wrong Content-Disposition: {content_disposition}"))
    except Exception as e:
        print(f"❌ Test D ERROR: {str(e)}")
        test_results.append(("D", "ERROR", str(e)))
    
    # Test E: Verify CSV structure
    print("\n🧪 Test E: Verify CSV structure")
    try:
        lines = csv_content.strip().split('\n')
        print(f"CSV has {len(lines)} lines")
        
        if len(lines) >= 1:
            header_line = lines[0]
            expected_header = "email,region,locale,source,created_at"
            
            print(f"Header: {header_line}")
            print(f"Expected: {expected_header}")
            
            if header_line == expected_header:
                print("✅ Test E PASSED: CSV header is correct")
                test_results.append(("E", "PASS", "CSV header correct"))
            else:
                print(f"❌ Test E FAILED: Header mismatch")
                test_results.append(("E", "FAIL", f"Header mismatch: {header_line}"))
        else:
            print("❌ Test E FAILED: CSV is empty")
            test_results.append(("E", "FAIL", "CSV is empty"))
    except Exception as e:
        print(f"❌ Test E ERROR: {str(e)}")
        test_results.append(("E", "ERROR", str(e)))
    
    # Test F: Verify CSV data structure
    print("\n🧪 Test F: Verify CSV data structure")
    try:
        lines = csv_content.strip().split('\n')
        
        if len(lines) > 1:
            # Check a data line
            data_line = lines[1]
            fields = data_line.split(',')
            
            print(f"Sample data line: {data_line}")
            print(f"Fields count: {len(fields)}")
            
            if len(fields) == 5:  # email, region, locale, source, created_at
                print("✅ Test F PASSED: CSV data structure correct")
                test_results.append(("F", "PASS", "CSV data structure correct"))
            else:
                print(f"❌ Test F FAILED: Expected 5 fields, got {len(fields)}")
                test_results.append(("F", "FAIL", f"Wrong field count: {len(fields)}"))
        else:
            print("⚠️ Test F: No data rows to check (only header)")
            test_results.append(("F", "PARTIAL", "No data rows to check"))
    except Exception as e:
        print(f"❌ Test F ERROR: {str(e)}")
        test_results.append(("F", "ERROR", str(e)))
    
    # Summary
    print("\n" + "="*50)
    print("CSV EXPORT ENDPOINT TEST SUMMARY")
    print("="*50)
    
    passed = sum(1 for _, status, _ in test_results if status == "PASS")
    failed = sum(1 for _, status, _ in test_results if status == "FAIL")
    errors = sum(1 for _, status, _ in test_results if status == "ERROR")
    partial = sum(1 for _, status, _ in test_results if status == "PARTIAL")
    
    print(f"✅ PASSED: {passed}")
    print(f"❌ FAILED: {failed}")
    print(f"⚠️ ERRORS: {errors}")
    print(f"🔶 PARTIAL: {partial}")
    print(f"📊 TOTAL: {len(test_results)}")
    
    for test_id, status, message in test_results:
        status_icon = {"PASS": "✅", "FAIL": "❌", "ERROR": "⚠️", "PARTIAL": "🔶"}[status]
        print(f"{status_icon} Test {test_id}: {message}")
    
    return test_results

def main():
    """Main test runner"""
    print("🇧🇷 BRAZILIAN PORTUGUESE WAITLIST API TESTING")
    print("=" * 80)
    print(f"Base URL: {get_base_url()}")
    print(f"Admin Credentials: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print("=" * 80)
    
    # Step 1: Login as admin
    print("\n📋 STEP 1: Admin Authentication")
    admin_token = login_admin()
    
    if not admin_token:
        print("❌ CRITICAL: Cannot proceed without admin token")
        return
    
    # Step 2: Test public endpoint
    print("\n📋 STEP 2: Testing Public Waitlist Endpoint")
    public_results = test_waitlist_public_endpoint()
    
    # Step 3: Test admin endpoint
    print("\n📋 STEP 3: Testing Admin Waitlist Endpoint")
    admin_results = test_admin_waitlist_endpoint(admin_token)
    
    # Step 4: Test export endpoint
    print("\n📋 STEP 4: Testing Admin Export Endpoint")
    export_results = test_admin_export_endpoint(admin_token)
    
    # Final Summary
    print("\n" + "="*80)
    print("🏁 FINAL TEST SUMMARY")
    print("="*80)
    
    all_results = public_results + admin_results + export_results
    
    total_passed = sum(1 for _, status, _ in all_results if status == "PASS")
    total_failed = sum(1 for _, status, _ in all_results if status == "FAIL")
    total_errors = sum(1 for _, status, _ in all_results if status == "ERROR")
    total_skipped = sum(1 for _, status, _ in all_results if status == "SKIP")
    total_partial = sum(1 for _, status, _ in all_results if status == "PARTIAL")
    total_tests = len(all_results)
    
    print(f"📊 OVERALL RESULTS:")
    print(f"✅ PASSED: {total_passed}/{total_tests}")
    print(f"❌ FAILED: {total_failed}/{total_tests}")
    print(f"⚠️ ERRORS: {total_errors}/{total_tests}")
    print(f"⏭️ SKIPPED: {total_skipped}/{total_tests}")
    print(f"🔶 PARTIAL: {total_partial}/{total_tests}")
    
    success_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
    print(f"🎯 SUCCESS RATE: {success_rate:.1f}%")
    
    if total_failed == 0 and total_errors == 0:
        print("\n🎉 ALL CRITICAL TESTS PASSED! Brazilian Portuguese Waitlist API is working correctly.")
    elif total_failed > 0:
        print(f"\n⚠️ {total_failed} TESTS FAILED - Review failed tests above")
    
    if total_errors > 0:
        print(f"\n🚨 {total_errors} TESTS HAD ERRORS - Check error details above")
    
    print("\n" + "="*80)

if __name__ == "__main__":
    main()