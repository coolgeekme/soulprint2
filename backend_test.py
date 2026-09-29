#!/usr/bin/env python3
"""
Backend Test Suite for SoulPrint Engine
Tests SEO/metadata endpoints: robots.txt, sitemap.xml, llms.txt, and page-specific titles
"""

import requests
import sys
from typing import Dict, Any

# Base URL from environment
BASE_URL = "https://soulprint-engine.preview.emergentagent.com"

def test_robots_txt() -> Dict[str, Any]:
    """
    Test GET /robots.txt
    Expected:
    - HTTP 200
    - Content-Type: text/plain
    - Body starts with "User-Agent: *"
    """
    print("\n" + "="*80)
    print("TEST 1: GET /robots.txt")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/robots.txt"
        print(f"Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        print(f"Response Length: {len(response.text)} characters")
        print(f"First 200 characters:\n{response.text[:200]}")
        
        # Verify status code
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            return {"test": "robots.txt", "passed": False, "error": f"Status {response.status_code}"}
        
        # Verify Content-Type
        content_type = response.headers.get('Content-Type', '')
        if 'text/plain' not in content_type:
            print(f"❌ FAILED: Expected Content-Type text/plain, got {content_type}")
            return {"test": "robots.txt", "passed": False, "error": f"Wrong Content-Type: {content_type}"}
        
        # Verify body starts with "User-Agent: *" (case-insensitive, allowing whitespace)
        body = response.text.strip()
        if not body.lower().startswith("user-agent:"):
            print(f"❌ FAILED: Body does not start with 'User-Agent:'")
            return {"test": "robots.txt", "passed": False, "error": "Body doesn't start with User-Agent"}
        
        # Check if it contains "User-Agent: *" specifically
        if "User-Agent: *" not in body[:100]:
            print(f"⚠️  WARNING: Body starts with User-Agent but not 'User-Agent: *'")
        
        print("✅ PASSED: /robots.txt returns 200, text/plain, starts with User-Agent")
        return {"test": "robots.txt", "passed": True}
        
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {str(e)}")
        return {"test": "robots.txt", "passed": False, "error": str(e)}


def test_sitemap_xml() -> Dict[str, Any]:
    """
    Test GET /sitemap.xml
    Expected:
    - HTTP 200
    - Body contains <loc>https://soulprintengine.ai/features</loc>
    """
    print("\n" + "="*80)
    print("TEST 2: GET /sitemap.xml")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/sitemap.xml"
        print(f"Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        print(f"Response Length: {len(response.text)} characters")
        
        # Verify status code
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            return {"test": "sitemap.xml", "passed": False, "error": f"Status {response.status_code}"}
        
        # Verify body contains features URL
        body = response.text
        features_url = "https://soulprintengine.ai/features"
        
        if features_url not in body:
            print(f"❌ FAILED: Body does not contain '{features_url}'")
            print(f"First 500 characters of body:\n{body[:500]}")
            return {"test": "sitemap.xml", "passed": False, "error": f"Missing {features_url}"}
        
        # Count how many URLs are in the sitemap
        url_count = body.count("<loc>")
        print(f"Found {url_count} URLs in sitemap")
        print(f"✅ Confirmed: Contains {features_url}")
        
        print("✅ PASSED: /sitemap.xml returns 200 and contains features URL")
        return {"test": "sitemap.xml", "passed": True}
        
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {str(e)}")
        return {"test": "sitemap.xml", "passed": False, "error": str(e)}


def test_llms_txt() -> Dict[str, Any]:
    """
    Test GET /llms.txt
    Expected:
    - HTTP 200
    - Content-Type: text/plain
    - Body starts with "# SoulPrint Engine"
    """
    print("\n" + "="*80)
    print("TEST 3: GET /llms.txt")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/llms.txt"
        print(f"Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        print(f"Response Length: {len(response.text)} characters")
        print(f"First 200 characters:\n{response.text[:200]}")
        
        # Verify status code
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            return {"test": "llms.txt", "passed": False, "error": f"Status {response.status_code}"}
        
        # Verify Content-Type
        content_type = response.headers.get('Content-Type', '')
        if 'text/plain' not in content_type:
            print(f"❌ FAILED: Expected Content-Type text/plain, got {content_type}")
            return {"test": "llms.txt", "passed": False, "error": f"Wrong Content-Type: {content_type}"}
        
        # Verify body starts with "# SoulPrint Engine"
        body = response.text.strip()
        expected_start = "# SoulPrint Engine"
        
        if not body.startswith(expected_start):
            print(f"❌ FAILED: Body does not start with '{expected_start}'")
            print(f"Actual start: {body[:50]}")
            return {"test": "llms.txt", "passed": False, "error": f"Body doesn't start with '{expected_start}'"}
        
        print(f"✅ Confirmed: Body starts with '{expected_start}'")
        print("✅ PASSED: /llms.txt returns 200, text/plain, starts with '# SoulPrint Engine'")
        return {"test": "llms.txt", "passed": True}
        
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {str(e)}")
        return {"test": "llms.txt", "passed": False, "error": str(e)}


def test_pricing_page_title() -> Dict[str, Any]:
    """
    Test GET /pricing
    Expected:
    - HTTP 200
    - HTML title is "Pricing — Free During Beta | SoulPrint Engine"
    """
    print("\n" + "="*80)
    print("TEST 4: GET /pricing (Page-specific title)")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/pricing"
        print(f"Request: GET {url}")
        
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        print(f"Response Length: {len(response.text)} characters")
        
        # Verify status code
        if response.status_code != 200:
            print(f"❌ FAILED: Expected status 200, got {response.status_code}")
            return {"test": "pricing page title", "passed": False, "error": f"Status {response.status_code}"}
        
        # Extract title from HTML
        body = response.text
        
        # Find <title> tag
        title_start = body.find("<title>")
        title_end = body.find("</title>")
        
        if title_start == -1 or title_end == -1:
            print(f"❌ FAILED: Could not find <title> tag in HTML")
            return {"test": "pricing page title", "passed": False, "error": "No <title> tag found"}
        
        title = body[title_start + 7:title_end].strip()
        print(f"Found title: '{title}'")
        
        # Expected title (with template applied)
        expected_title = "Pricing — Free During Beta | SoulPrint Engine"
        
        if title != expected_title:
            print(f"❌ FAILED: Title mismatch")
            print(f"Expected: '{expected_title}'")
            print(f"Got:      '{title}'")
            return {"test": "pricing page title", "passed": False, "error": f"Title is '{title}', expected '{expected_title}'"}
        
        print(f"✅ Confirmed: Title matches expected value")
        print("✅ PASSED: /pricing has correct page-specific title")
        return {"test": "pricing page title", "passed": True}
        
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {str(e)}")
        return {"test": "pricing page title", "passed": False, "error": str(e)}


def main():
    """Run all SEO/metadata tests"""
    print("\n" + "="*80)
    print("SEO/METADATA COMMIT VERIFICATION TEST SUITE")
    print("Commit: 7a0dd19")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    
    results = []
    
    # Run all tests
    results.append(test_robots_txt())
    results.append(test_sitemap_xml())
    results.append(test_llms_txt())
    results.append(test_pricing_page_title())
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in results if r.get("passed"))
    total = len(results)
    
    for result in results:
        status = "✅ PASS" if result.get("passed") else "❌ FAIL"
        test_name = result.get("test", "unknown")
        print(f"{status}: {test_name}")
        if not result.get("passed") and "error" in result:
            print(f"         Error: {result['error']}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - SEO/metadata commit verified successfully!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - see details above")
        return 1


if __name__ == "__main__":
    sys.exit(main())
