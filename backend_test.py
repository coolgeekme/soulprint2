#!/usr/bin/env python3
"""
Backend Testing Script for Pricing & Subscription System
Tests all critical pricing endpoints as specified in the review request
"""

import requests
import json
import time
import sys
import os
from urllib.parse import urljoin

# Configuration
BASE_URL = "https://perfil-soul.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "testchat@example.com"
TEST_PASSCODE = "Test123456"
TEST_USER_ID = "5cae9ba6-193d-473a-b18f-9785aa8f93cf"

class PricingTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def authenticate(self):
        """Authenticate and get auth token"""
        try:
            self.log("🔐 Authenticating admin user...")
            response = self.session.post(f"{API_BASE}/auth/login", json={
                "email": TEST_EMAIL,
                "passcode": TEST_PASSCODE
            })
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('token')
                self.user_id = data.get('userId') or data.get('user', {}).get('id')
                self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                self.log(f"✅ Authentication successful. User ID: {self.user_id}")
                return True
            else:
                self.log(f"❌ Authentication failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Authentication error: {str(e)}", "ERROR")
            return False
    
    def test_health_check(self):
        """Test basic health check"""
        try:
            self.log("🏥 Testing health check...")
            response = self.session.get(f"{API_BASE}/health")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'ok':
                    self.log("✅ Health check passed")
                    return True
                else:
                    self.log(f"❌ Health check failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Health check failed: {response.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Health check error: {str(e)}", "ERROR")
            return False
    
    def test_get_pricing_plans(self):
        """Test GET /api/pricing/plans (PUBLIC, no auth needed)"""
        try:
            self.log("💰 Testing GET /api/pricing/plans (public)...")
            # Remove auth header temporarily for public test
            headers = self.session.headers.copy()
            if 'Authorization' in self.session.headers:
                del self.session.headers['Authorization']
            
            response = self.session.get(f"{API_BASE}/pricing/plans")
            
            # Restore auth header
            self.session.headers = headers
            
            if response.status_code == 200:
                data = response.json()
                plans = data.get('plans', [])
                if len(plans) == 3:
                    plan_names = [p.get('name') for p in plans]
                    plan_prices = [p.get('price_monthly') for p in plans]
                    if 'Free' in plan_names and 'Base' in plan_names and 'Power' in plan_names:
                        if 0 in plan_prices and 20.01 in plan_prices and 99 in plan_prices:
                            self.log("✅ GET /api/pricing/plans working - returns 3 plans (free $0, base $20.01, power $99)")
                            return True
                        else:
                            self.log(f"❌ Plan prices incorrect: {plan_prices}", "ERROR")
                            return False
                    else:
                        self.log(f"❌ Plan names incorrect: {plan_names}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Expected 3 plans, got {len(plans)}", "ERROR")
                    return False
            else:
                self.log(f"❌ GET /api/pricing/plans failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GET /api/pricing/plans error: {str(e)}", "ERROR")
            return False
    
    def test_get_subscription(self):
        """Test GET /api/pricing/subscription (AUTH required)"""
        try:
            self.log("📋 Testing GET /api/pricing/subscription (auth required)...")
            response = self.session.get(f"{API_BASE}/pricing/subscription")
            
            if response.status_code == 200:
                data = response.json()
                subscription = data.get('subscription')
                plan = data.get('plan')
                if subscription and plan:
                    plan_id = subscription.get('plan_id')
                    status = subscription.get('status')
                    if plan_id == 'free' and status == 'active':
                        self.log("✅ GET /api/pricing/subscription working - returns current subscription (plan_id: free, status: active)")
                        return True
                    else:
                        self.log(f"❌ Subscription details incorrect: plan_id={plan_id}, status={status}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Missing subscription or plan data", "ERROR")
                    return False
            else:
                self.log(f"❌ GET /api/pricing/subscription failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GET /api/pricing/subscription error: {str(e)}", "ERROR")
            return False
    
    def test_get_usage(self):
        """Test GET /api/pricing/usage (AUTH required)"""
        try:
            self.log("📊 Testing GET /api/pricing/usage (auth required)...")
            response = self.session.get(f"{API_BASE}/pricing/usage")
            
            if response.status_code == 200:
                data = response.json()
                if 'plan' in data and 'period' in data and 'usage' in data and 'limits' in data:
                    plan_name = data.get('plan_name', 'Unknown')
                    period = data.get('period')
                    if period and len(period) == 7 and '-' in period:  # Format: YYYY-MM
                        self.log(f"✅ GET /api/pricing/usage working - returns usage summary (plan: {plan_name}, period: {period})")
                        return True
                    else:
                        self.log(f"❌ Invalid period format: {period}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Missing required fields in usage response", "ERROR")
                    return False
            else:
                self.log(f"❌ GET /api/pricing/usage failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GET /api/pricing/usage error: {str(e)}", "ERROR")
            return False
    
    def test_get_credits(self):
        """Test GET /api/pricing/credits (AUTH required)"""
        try:
            self.log("🎯 Testing GET /api/pricing/credits (auth required)...")
            response = self.session.get(f"{API_BASE}/pricing/credits")
            
            if response.status_code == 200:
                data = response.json()
                if 'balance' in data and 'total_purchased' in data and 'total_spent' in data:
                    balance = data.get('balance', 0)
                    total_purchased = data.get('total_purchased', 0)
                    total_spent = data.get('total_spent', 0)
                    self.log(f"✅ GET /api/pricing/credits working - returns credits (balance: {balance}, purchased: {total_purchased}, spent: {total_spent})")
                    return True
                else:
                    self.log(f"❌ Missing required fields in credits response", "ERROR")
                    return False
            else:
                self.log(f"❌ GET /api/pricing/credits failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GET /api/pricing/credits error: {str(e)}", "ERROR")
            return False
    
    def test_checkout_base_monthly(self):
        """Test POST /api/pricing/checkout (AUTH required) - Base plan monthly"""
        try:
            self.log("💳 Testing POST /api/pricing/checkout - Base plan monthly (auth required)...")
            response = self.session.post(f"{API_BASE}/pricing/checkout", json={
                "planId": "base",
                "billingPeriod": "monthly",
                "originUrl": "https://soulprintengine.ai"
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'url' in data and 'session_id' in data:
                    url = data.get('url')
                    session_id = data.get('session_id')
                    if 'checkout.stripe.com' in url and session_id.startswith('cs_test_'):
                        self.log(f"✅ POST /api/pricing/checkout (Base monthly) working - returns Stripe checkout URL and session_id")
                        return True
                    else:
                        self.log(f"❌ Invalid checkout response format", "ERROR")
                        return False
                else:
                    self.log(f"❌ Missing url or session_id in checkout response", "ERROR")
                    return False
            else:
                self.log(f"❌ POST /api/pricing/checkout failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ POST /api/pricing/checkout error: {str(e)}", "ERROR")
            return False
    
    def test_checkout_power_annual(self):
        """Test POST /api/pricing/checkout with annual billing (AUTH required) - Power plan annual"""
        try:
            self.log("💳 Testing POST /api/pricing/checkout - Power plan annual (auth required)...")
            response = self.session.post(f"{API_BASE}/pricing/checkout", json={
                "planId": "power",
                "billingPeriod": "annual",
                "originUrl": "https://soulprintengine.ai"
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'url' in data and 'session_id' in data:
                    url = data.get('url')
                    session_id = data.get('session_id')
                    if 'checkout.stripe.com' in url and session_id.startswith('cs_test_'):
                        self.log(f"✅ POST /api/pricing/checkout (Power annual) working - returns Stripe checkout URL and session_id")
                        return True
                    else:
                        self.log(f"❌ Invalid checkout response format", "ERROR")
                        return False
                else:
                    self.log(f"❌ Missing url or session_id in checkout response", "ERROR")
                    return False
            else:
                self.log(f"❌ POST /api/pricing/checkout (Power annual) failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ POST /api/pricing/checkout (Power annual) error: {str(e)}", "ERROR")
            return False
    
    def test_validate_discount_good(self):
        """Test POST /api/pricing/discounts/validate (PUBLIC) - Valid code"""
        try:
            self.log("🎫 Testing POST /api/pricing/discounts/validate - Valid code (public)...")
            # Remove auth header temporarily for public test
            headers = self.session.headers.copy()
            if 'Authorization' in self.session.headers:
                del self.session.headers['Authorization']
            
            response = self.session.post(f"{API_BASE}/pricing/discounts/validate", json={
                "code": "LAUNCH20"
            })
            
            # Restore auth header
            self.session.headers = headers
            
            if response.status_code == 200:
                data = response.json()
                if data.get('valid') == True:
                    discount_type = data.get('type')
                    value = data.get('value')
                    if discount_type == 'percent_off' and value == 20:
                        self.log(f"✅ POST /api/pricing/discounts/validate (LAUNCH20) working - returns valid: true, type: percent_off, value: 20")
                        return True
                    else:
                        self.log(f"❌ Discount details incorrect: type={discount_type}, value={value}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Discount validation failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ POST /api/pricing/discounts/validate failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ POST /api/pricing/discounts/validate error: {str(e)}", "ERROR")
            return False
    
    def test_validate_discount_bad(self):
        """Test POST /api/pricing/discounts/validate with bad code"""
        try:
            self.log("🎫 Testing POST /api/pricing/discounts/validate - Bad code (public)...")
            # Remove auth header temporarily for public test
            headers = self.session.headers.copy()
            if 'Authorization' in self.session.headers:
                del self.session.headers['Authorization']
            
            response = self.session.post(f"{API_BASE}/pricing/discounts/validate", json={
                "code": "BADCODE"
            })
            
            # Restore auth header
            self.session.headers = headers
            
            if response.status_code == 200:
                data = response.json()
                if data.get('valid') == False and 'error' in data:
                    error_msg = data.get('error')
                    if 'Invalid discount code' in error_msg:
                        self.log(f"✅ POST /api/pricing/discounts/validate (BADCODE) working - returns valid: false, error: 'Invalid discount code'")
                        return True
                    else:
                        self.log(f"❌ Wrong error message: {error_msg}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Bad code validation should return valid: false with error", "ERROR")
                    return False
            else:
                self.log(f"❌ POST /api/pricing/discounts/validate (bad code) failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ POST /api/pricing/discounts/validate (bad code) error: {str(e)}", "ERROR")
            return False
    
    def test_admin_overview(self):
        """Test GET /api/pricing/admin/overview (ADMIN required)"""
        try:
            self.log("👑 Testing GET /api/pricing/admin/overview (admin required)...")
            response = self.session.get(f"{API_BASE}/pricing/admin/overview")
            
            if response.status_code == 200:
                data = response.json()
                if 'free' in data and 'base' in data and 'power' in data and 'total' in data:
                    free_count = data.get('free', 0)
                    base_count = data.get('base', 0)
                    power_count = data.get('power', 0)
                    total_count = data.get('total', 0)
                    self.log(f"✅ GET /api/pricing/admin/overview working - returns subscription counts (free: {free_count}, base: {base_count}, power: {power_count}, total: {total_count})")
                    return True
                else:
                    self.log(f"❌ Missing required fields in admin overview", "ERROR")
                    return False
            else:
                self.log(f"❌ GET /api/pricing/admin/overview failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GET /api/pricing/admin/overview error: {str(e)}", "ERROR")
            return False
    
    def test_admin_plans(self):
        """Test GET /api/pricing/admin/plans (ADMIN required)"""
        try:
            self.log("👑 Testing GET /api/pricing/admin/plans (admin required)...")
            response = self.session.get(f"{API_BASE}/pricing/admin/plans")
            
            if response.status_code == 200:
                data = response.json()
                plans = data.get('plans', [])
                if len(plans) >= 3:
                    # Check if plans have Stripe price IDs populated
                    stripe_populated = 0
                    for plan in plans:
                        if plan.get('stripe_price_id_monthly') or plan.get('stripe_price_id_annual'):
                            stripe_populated += 1
                    
                    if stripe_populated >= 2:  # Base and Power should have Stripe IDs
                        self.log(f"✅ GET /api/pricing/admin/plans working - returns {len(plans)} plans with Stripe price IDs populated")
                        return True
                    else:
                        self.log(f"❌ Not enough plans have Stripe price IDs populated: {stripe_populated}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Expected at least 3 plans, got {len(plans)}", "ERROR")
                    return False
            else:
                self.log(f"❌ GET /api/pricing/admin/plans failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GET /api/pricing/admin/plans error: {str(e)}", "ERROR")
            return False
    
    def test_admin_discounts(self):
        """Test GET /api/pricing/admin/discounts (ADMIN required)"""
        try:
            self.log("👑 Testing GET /api/pricing/admin/discounts (admin required)...")
            response = self.session.get(f"{API_BASE}/pricing/admin/discounts")
            
            if response.status_code == 200:
                data = response.json()
                discounts = data.get('discounts', [])
                # Check if LAUNCH20 and LIFETIME2026 exist
                codes = [d.get('code') for d in discounts]
                if 'LAUNCH20' in codes and 'LIFETIME2026' in codes:
                    self.log(f"✅ GET /api/pricing/admin/discounts working - returns discount codes including LAUNCH20 and LIFETIME2026")
                    return True
                else:
                    self.log(f"❌ Missing expected discount codes. Found: {codes}", "ERROR")
                    return False
            else:
                self.log(f"❌ GET /api/pricing/admin/discounts failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GET /api/pricing/admin/discounts error: {str(e)}", "ERROR")
            return False
    
    def test_admin_set_user_plan_power(self):
        """Test POST /api/pricing/admin/user-plan (ADMIN required) - Set to Power"""
        try:
            self.log("👑 Testing POST /api/pricing/admin/user-plan - Set to Power (admin required)...")
            response = self.session.post(f"{API_BASE}/pricing/admin/user-plan", json={
                "userId": TEST_USER_ID,
                "planId": "power",
                "reason": "test override"
            })
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') == True:
                    self.log(f"✅ POST /api/pricing/admin/user-plan (Power) working - returns success: true")
                    return True
                else:
                    self.log(f"❌ Admin user plan update failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ POST /api/pricing/admin/user-plan failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ POST /api/pricing/admin/user-plan error: {str(e)}", "ERROR")
            return False
    
    def test_subscription_after_plan_change(self):
        """Test GET /api/pricing/subscription after plan change - Should show Power"""
        try:
            self.log("📋 Testing GET /api/pricing/subscription after plan change...")
            response = self.session.get(f"{API_BASE}/pricing/subscription")
            
            if response.status_code == 200:
                data = response.json()
                subscription = data.get('subscription')
                if subscription:
                    plan_id = subscription.get('plan_id')
                    if plan_id == 'power':
                        self.log(f"✅ GET /api/pricing/subscription after plan change working - now shows plan_id: power")
                        return True
                    else:
                        self.log(f"❌ Plan ID should be 'power' but got: {plan_id}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Missing subscription data", "ERROR")
                    return False
            else:
                self.log(f"❌ GET /api/pricing/subscription after plan change failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GET /api/pricing/subscription after plan change error: {str(e)}", "ERROR")
            return False
    
    def test_admin_set_user_plan_free(self):
        """Test POST /api/pricing/admin/user-plan (ADMIN required) - Reset to Free"""
        try:
            self.log("👑 Testing POST /api/pricing/admin/user-plan - Reset to Free (admin required)...")
            response = self.session.post(f"{API_BASE}/pricing/admin/user-plan", json={
                "userId": TEST_USER_ID,
                "planId": "free",
                "reason": "reset"
            })
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') == True:
                    self.log(f"✅ POST /api/pricing/admin/user-plan (Free reset) working - returns success: true")
                    return True
                else:
                    self.log(f"❌ Admin user plan reset failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ POST /api/pricing/admin/user-plan (reset) failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ POST /api/pricing/admin/user-plan (reset) error: {str(e)}", "ERROR")
            return False
    
    def test_get_credit_packs(self):
        """Test GET /api/pricing/credit-packs (PUBLIC)"""
        try:
            self.log("🎯 Testing GET /api/pricing/credit-packs (public)...")
            # Remove auth header temporarily for public test
            headers = self.session.headers.copy()
            if 'Authorization' in self.session.headers:
                del self.session.headers['Authorization']
            
            response = self.session.get(f"{API_BASE}/pricing/credit-packs")
            
            # Restore auth header
            self.session.headers = headers
            
            if response.status_code == 200:
                data = response.json()
                packs = data.get('packs', [])
                if len(packs) == 4:
                    pack_names = [p.get('name') for p in packs]
                    pack_ids = [p.get('id') for p in packs]
                    if 'spark' in pack_ids and 'creator' in pack_ids and 'pro' in pack_ids and 'studio' in pack_ids:
                        self.log(f"✅ GET /api/pricing/credit-packs working - returns 4 credit packs (spark, creator, pro, studio)")
                        return True
                    else:
                        self.log(f"❌ Missing expected credit pack IDs: {pack_ids}", "ERROR")
                        return False
                else:
                    self.log(f"❌ Expected 4 credit packs, got {len(packs)}", "ERROR")
                    return False
            else:
                self.log(f"❌ GET /api/pricing/credit-packs failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ GET /api/pricing/credit-packs error: {str(e)}", "ERROR")
            return False
    
    def test_checkout_credits(self):
        """Test POST /api/pricing/checkout/credits (AUTH required)"""
        try:
            self.log("💳 Testing POST /api/pricing/checkout/credits - Spark pack (auth required)...")
            response = self.session.post(f"{API_BASE}/pricing/checkout/credits", json={
                "packId": "spark",
                "originUrl": "https://soulprintengine.ai"
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'url' in data and 'session_id' in data:
                    url = data.get('url')
                    session_id = data.get('session_id')
                    if 'checkout.stripe.com' in url and session_id.startswith('cs_test_'):
                        self.log(f"✅ POST /api/pricing/checkout/credits (Spark) working - returns Stripe checkout URL for $2.99 pack")
                        return True
                    else:
                        self.log(f"❌ Invalid credit checkout response format", "ERROR")
                        return False
                else:
                    self.log(f"❌ Missing url or session_id in credit checkout response", "ERROR")
                    return False
            else:
                self.log(f"❌ POST /api/pricing/checkout/credits failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ POST /api/pricing/checkout/credits error: {str(e)}", "ERROR")
            return False
    
    def test_admin_grace_period(self):
        """Test POST /api/pricing/admin/grace-period (ADMIN required)"""
        try:
            self.log("👑 Testing POST /api/pricing/admin/grace-period (admin required)...")
            response = self.session.post(f"{API_BASE}/pricing/admin/grace-period", json={
                "days": 14
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'users_affected' in data and 'grace_period_end' in data:
                    users_affected = data.get('users_affected')
                    grace_period_end = data.get('grace_period_end')
                    self.log(f"✅ POST /api/pricing/admin/grace-period working - affected {users_affected} users, grace period end: {grace_period_end}")
                    return True
                else:
                    self.log(f"❌ Missing required fields in grace period response", "ERROR")
                    return False
            else:
                self.log(f"❌ POST /api/pricing/admin/grace-period failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ POST /api/pricing/admin/grace-period error: {str(e)}", "ERROR")
            return False
    
    def setup_discount_codes(self):
        """Setup required discount codes for testing"""
        try:
            self.log("🎫 Setting up discount codes for testing...")
            
            # Create LAUNCH20 discount code
            response1 = self.session.post(f"{API_BASE}/pricing/admin/discounts", json={
                "code": "LAUNCH20",
                "type": "percent_off",
                "value": 20,
                "plan_ids": ["base", "power"],
                "description": "Launch discount - 20% off"
            })
            
            # Create LIFETIME2026 discount code
            response2 = self.session.post(f"{API_BASE}/pricing/admin/discounts", json={
                "code": "LIFETIME2026",
                "type": "percent_off",
                "value": 100,
                "plan_ids": ["base", "power"],
                "is_lifetime_deal": True,
                "description": "Lifetime deal - 100% off"
            })
            
            # Don't fail if codes already exist (409 conflict is expected)
            success1 = response1.status_code in [200, 409]
            success2 = response2.status_code in [200, 409]
            
            if success1 and success2:
                self.log("✅ Discount codes setup complete (LAUNCH20 and LIFETIME2026)")
                return True
            else:
                self.log(f"❌ Failed to setup discount codes: {response1.status_code}, {response2.status_code}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Setup discount codes error: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all pricing & subscription tests"""
        self.log("🚀 Starting Pricing & Subscription Backend Tests")
        self.log("=" * 60)
        
        tests = [
            ("Health Check", self.test_health_check),
            ("Authentication", self.authenticate),
            ("Setup Discount Codes", self.setup_discount_codes),
            ("GET /api/pricing/plans (PUBLIC)", self.test_get_pricing_plans),
            ("GET /api/pricing/subscription (AUTH)", self.test_get_subscription),
            ("GET /api/pricing/usage (AUTH)", self.test_get_usage),
            ("GET /api/pricing/credits (AUTH)", self.test_get_credits),
            ("POST /api/pricing/checkout - Base Monthly (AUTH)", self.test_checkout_base_monthly),
            ("POST /api/pricing/checkout - Power Annual (AUTH)", self.test_checkout_power_annual),
            ("POST /api/pricing/discounts/validate - Valid Code (PUBLIC)", self.test_validate_discount_good),
            ("POST /api/pricing/discounts/validate - Bad Code (PUBLIC)", self.test_validate_discount_bad),
            ("GET /api/pricing/admin/overview (ADMIN)", self.test_admin_overview),
            ("GET /api/pricing/admin/plans (ADMIN)", self.test_admin_plans),
            ("GET /api/pricing/admin/discounts (ADMIN)", self.test_admin_discounts),
            ("POST /api/pricing/admin/user-plan - Set Power (ADMIN)", self.test_admin_set_user_plan_power),
            ("GET /api/pricing/subscription - After Plan Change", self.test_subscription_after_plan_change),
            ("POST /api/pricing/admin/user-plan - Reset Free (ADMIN)", self.test_admin_set_user_plan_free),
            ("GET /api/pricing/credit-packs (PUBLIC)", self.test_get_credit_packs),
            ("POST /api/pricing/checkout/credits - Spark (AUTH)", self.test_checkout_credits),
            ("POST /api/pricing/admin/grace-period (ADMIN)", self.test_admin_grace_period),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            self.log(f"\n📋 Running: {test_name}")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log(f"❌ {test_name} crashed: {str(e)}", "ERROR")
                failed += 1
        
        self.log("\n" + "=" * 60)
        self.log(f"🏁 Pricing & Subscription Tests Complete")
        self.log(f"✅ Passed: {passed}")
        self.log(f"❌ Failed: {failed}")
        self.log(f"📊 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed == 0:
            self.log("🎉 All tests passed! Pricing & Subscription system is working correctly.")
        else:
            self.log("⚠️  Some tests failed. Check the logs above for details.")
        
        return failed == 0

def main():
    """Main test execution"""
    tester = PricingTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()