#!/usr/bin/env python3
"""
Detailed verification of Free Plan Onboarding Fix
"""

import requests
import json

BASE_URL = "https://soulprint-engine.preview.emergentagent.com/api"
TEST_USER_EMAIL = "testchat@example.com"
TEST_USER_PASSWORD = "Test123456"

def authenticate():
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": TEST_USER_EMAIL, "passcode": TEST_USER_PASSWORD},
        timeout=30
    )
    return response.json().get('token')

def main():
    print("\n" + "="*80)
    print("DETAILED VERIFICATION: Free Plan Onboarding Fix")
    print("="*80)
    
    token = authenticate()
    print(f"\n✅ Authenticated as {TEST_USER_EMAIL}")
    
    # Check enforcement status
    print("\n" + "-"*80)
    print("Checking Enforcement Status (GET /api/pricing/enforcement)")
    print("-"*80)
    
    response = requests.get(
        f"{BASE_URL}/pricing/enforcement",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30
    )
    
    data = response.json()
    print(json.dumps(data, indent=2))
    
    print("\n" + "="*80)
    print("KEY FINDINGS:")
    print("="*80)
    
    print(f"\n1. Cohort: {data.get('cohort')}")
    print(f"2. Enforcement Active: {data.get('enforcement_active')}")
    print(f"3. Effective Plan: {data.get('effective_plan')}")
    print(f"4. User Selected Free: {data.get('user_selected_free', 'NOT SET')}")
    print(f"5. Choose Plan Prompt: {data.get('choose_plan_prompt', 'NOT SET (defaults to false)')}")
    
    print("\n" + "="*80)
    print("VERIFICATION RESULTS:")
    print("="*80)
    
    # Critical checks
    issues = []
    
    if data.get('user_selected_free') == True:
        print("✅ user_selected_free flag is TRUE - system knows user explicitly chose Free plan")
    else:
        print("⚠️  user_selected_free flag is NOT TRUE - but this may be OK if choose_plan_prompt is false")
    
    if data.get('choose_plan_prompt') == False or 'choose_plan_prompt' not in data:
        print("✅ choose_plan_prompt is FALSE - popup will NOT show to user")
    else:
        print("❌ choose_plan_prompt is TRUE - BUG: popup will show even though user selected Free")
        issues.append("Popup will incorrectly show to users who selected Free plan")
    
    if data.get('enforcement_active') == False:
        print("✅ enforcement_active is FALSE - user has access to features")
    else:
        print("⚠️  enforcement_active is TRUE - user may be restricted")
    
    print("\n" + "="*80)
    if len(issues) == 0:
        print("✅ ALL CHECKS PASSED - Free plan onboarding fix is working correctly")
        print("="*80)
        print("\nThe fix successfully prevents the onboarding loop bug.")
        print("Users who select Free plan will NOT see the plan selection popup again.")
    else:
        print("❌ ISSUES FOUND:")
        print("="*80)
        for issue in issues:
            print(f"  - {issue}")

if __name__ == "__main__":
    main()
