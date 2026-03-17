#!/usr/bin/env python3
"""
Admin Dashboard API Testing Suite
Tests the admin dashboard endpoints for SoulPrint application
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Test Configuration
BASE_URL = "https://auth-verification-4.preview.emergentagent.com"
BEARER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MzI0NjQ1OC05NDRlLTRhNmEtYmYyZS00ODVjOGEyNjkxYWUiLCJpYXQiOjE3NzM3NTk3ODQsImV4cCI6MTc3NjM1MTc4NH0.Bo1J90Dk8JnmM4LoHsF2v6lZUU0jaTlMEcQ7Ow4-Ak8"

def test_admin_metrics():
    """Test GET /api/admin/metrics endpoint with comprehensive field validation"""
    print("=== Testing Admin Metrics Endpoint ===")
    
    try:
        headers = {"Authorization": f"Bearer {BEARER_TOKEN}"}
        url = f"{BASE_URL}/api/admin/metrics"
        
        print(f"Testing: GET {url}")
        response = requests.get(url, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Successfully retrieved admin metrics")
            
            # Core metrics validation
            required_fields = [
                'wau', 'total_users', 'accepted_users', 'active_users_30d', 'waitlist_count',
                'multi_session_rate', 'day7_retention', 'avg_sessions_per_user_7d', 'avg_messages_per_session',
                'assessment_completion_rate', 'import_adoption_rate', 'csat',
                'recent_signups_30d', 'total_messages', 'total_messages_30d',
                'telegram_linked_users', 'telegram_messages', 'thumbs_up', 'thumbs_down',
                'est_total_cost', 'est_total_cost_30d', 'cost_by_model', 'cost_by_model_30d',
                'media_cost_total', 'media_cost_30d', 'media_cost_by_model', 'voice_chat'
            ]
            
            # NEW computed fields
            new_computed_fields = [
                'est_projected_monthly_cost', 'est_cost_per_active_user_30d', 'messages_per_active_user_30d', 'avg_cost_per_message_30d',
                'est_cost_per_user_all_time', 'messages_per_user_all_time', 'avg_cost_per_message'
            ]
            
            # NEW counts and totals
            new_counts = ['media_count_total', 'media_count_30d']
            new_totals = ['grand_total_cost', 'grand_total_cost_30d']
            
            all_required_fields = required_fields + new_computed_fields + new_counts + new_totals
            
            missing_fields = []
            null_fields = []
            
            for field in all_required_fields:
                if field not in data:
                    missing_fields.append(field)
                elif data[field] is None:
                    null_fields.append(field)
            
            # Validate telegram object structure
            if 'telegram' in data:
                telegram_fields = ['linked_users', 'adoption_rate', 'messages_total', 'messages_30d', 'weekly_active_users', 'conversations']
                for field in telegram_fields:
                    if field not in data['telegram']:
                        missing_fields.append(f'telegram.{field}')
                    elif data['telegram'][field] is None:
                        null_fields.append(f'telegram.{field}')
            else:
                missing_fields.append('telegram')
            
            # Validate platform_breakdown structure
            if 'platform_breakdown' in data:
                if 'web' in data['platform_breakdown']:
                    web_fields = ['messages_total', 'messages_30d']
                    for field in web_fields:
                        if field not in data['platform_breakdown']['web']:
                            missing_fields.append(f'platform_breakdown.web.{field}')
                else:
                    missing_fields.append('platform_breakdown.web')
                
                if 'telegram' in data['platform_breakdown']:
                    telegram_fields = ['messages_total', 'messages_30d']
                    for field in telegram_fields:
                        if field not in data['platform_breakdown']['telegram']:
                            missing_fields.append(f'platform_breakdown.telegram.{field}')
                else:
                    missing_fields.append('platform_breakdown.telegram')
            else:
                missing_fields.append('platform_breakdown')
            
            # Validate voice_chat structure
            if 'voice_chat' in data and data['voice_chat']:
                voice_fields = [
                    'total_sessions', 'sessions_7d', 'sessions_30d', 'completed_sessions', 'unique_users',
                    'total_duration_seconds', 'avg_duration_seconds', 'voice_distribution', 'cost'
                ]
                for field in voice_fields:
                    if field not in data['voice_chat']:
                        missing_fields.append(f'voice_chat.{field}')
                
                # Check cost sub-fields
                if 'cost' in data['voice_chat'] and data['voice_chat']['cost']:
                    cost_fields = ['total_cost_usd', 'cost_last_30d_usd', 'cost_per_minute_usd', 
                                 'avg_cost_per_session_usd', 'cost_per_user_usd', 'total_audio_input_tokens', 
                                 'total_audio_output_tokens']
                    for field in cost_fields:
                        if field not in data['voice_chat']['cost']:
                            missing_fields.append(f'voice_chat.cost.{field}')
            
            # Report validation results
            if missing_fields:
                print(f"❌ Missing fields: {missing_fields}")
                return False
            
            if null_fields:
                print(f"⚠️ Null/undefined fields: {null_fields}")
            
            # Validate number types
            numeric_fields_check = ['wau', 'total_users', 'accepted_users', 'active_users_30d']
            for field in numeric_fields_check:
                if field in data and not isinstance(data[field], (int, float)):
                    print(f"❌ Field '{field}' is not numeric: {type(data[field])}")
                    return False
            
            print("✅ All required fields present and properly typed")
            print(f"📊 Sample metrics: WAU={data.get('wau')}, Total Users={data.get('total_users')}, Grand Total Cost=${data.get('grand_total_cost')}")
            return True
            
        elif response.status_code == 403:
            print("❌ Unauthorized access (403) - token may be invalid or expired")
            return False
        else:
            print(f"❌ Request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing admin metrics: {str(e)}")
        return False

def test_admin_metrics_with_date_range():
    """Test admin metrics endpoint with date range parameters"""
    print("\n=== Testing Admin Metrics with Date Range ===")
    
    try:
        headers = {"Authorization": f"Bearer {BEARER_TOKEN}"}
        # Test with date range as specified in review request
        params = {
            'startDate': '2026-01-01',
            'endDate': '2026-03-17'
        }
        url = f"{BASE_URL}/api/admin/metrics"
        
        print(f"Testing: GET {url} with date range {params}")
        response = requests.get(url, headers=headers, params=params)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Successfully retrieved admin metrics with date range")
            print(f"📅 Date range applied: {params}")
            return True
        else:
            print(f"❌ Request failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing admin metrics with date range: {str(e)}")
        return False

def test_admin_insights():
    """Test GET /api/admin/insights endpoint with comprehensive field validation"""
    print("\n=== Testing Admin Insights Endpoint ===")
    
    try:
        headers = {"Authorization": f"Bearer {BEARER_TOKEN}"}
        url = f"{BASE_URL}/api/admin/insights"
        
        print(f"Testing: GET {url}")
        response = requests.get(url, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Successfully retrieved admin insights")
            
            # Core insights validation
            required_fields = [
                'generated_at', 'user_segments', 'pricing_recommendations', 'voice_costs'
            ]
            
            # NEW fields from review request
            new_fields = [
                'revenue_potential', 'top_users', 'model_popularity', 'feature_adoption',
                'churn_indicators', 'weekly_trends', 'media_insights'
            ]
            
            all_required_fields = required_fields + new_fields
            
            missing_fields = []
            
            for field in all_required_fields:
                if field not in data:
                    missing_fields.append(field)
            
            # Validate revenue_potential structure
            if 'revenue_potential' in data:
                if 'if_free_tier_20_msgs' in data['revenue_potential']:
                    tier_20_fields = ['paying_users', 'at_10_per_month', 'at_20_per_month']
                    for field in tier_20_fields:
                        if field not in data['revenue_potential']['if_free_tier_20_msgs']:
                            missing_fields.append(f'revenue_potential.if_free_tier_20_msgs.{field}')
                else:
                    missing_fields.append('revenue_potential.if_free_tier_20_msgs')
                
                if 'if_free_tier_50_msgs' in data['revenue_potential']:
                    tier_50_fields = ['paying_users', 'at_10_per_month', 'at_20_per_month']
                    for field in tier_50_fields:
                        if field not in data['revenue_potential']['if_free_tier_50_msgs']:
                            missing_fields.append(f'revenue_potential.if_free_tier_50_msgs.{field}')
                else:
                    missing_fields.append('revenue_potential.if_free_tier_50_msgs')
                
                if 'enterprise_candidates' not in data['revenue_potential']:
                    missing_fields.append('revenue_potential.enterprise_candidates')
            
            # Validate top_users structure (should be array)
            if 'top_users' in data and isinstance(data['top_users'], list) and len(data['top_users']) > 0:
                user_fields = ['name', 'email', 'messages', 'media_generated', 'estimated_cost', 'last_active']
                first_user = data['top_users'][0]
                for field in user_fields:
                    if field not in first_user:
                        missing_fields.append(f'top_users[0].{field}')
            
            # Validate model_popularity structure (should be array)
            if 'model_popularity' in data and isinstance(data['model_popularity'], list) and len(data['model_popularity']) > 0:
                model_fields = ['model', 'percentage', 'count']
                first_model = data['model_popularity'][0]
                for field in model_fields:
                    if field not in first_model:
                        missing_fields.append(f'model_popularity[0].{field}')
            
            # Validate feature_adoption structure
            if 'feature_adoption' in data:
                expected_features = ['assessment', 'onboarding']  # checking at least some features
                for feature in expected_features:
                    if feature in data['feature_adoption']:
                        feature_fields = ['rate', 'users']
                        for field in feature_fields:
                            if field not in data['feature_adoption'][feature]:
                                missing_fields.append(f'feature_adoption.{feature}.{field}')
            
            # Validate churn_indicators structure
            if 'churn_indicators' in data:
                churn_fields = ['inactive_30d', 'churn_rate', 'never_engaged', 'drop_off_rate']
                for field in churn_fields:
                    if field not in data['churn_indicators']:
                        missing_fields.append(f'churn_indicators.{field}')
            
            # Validate weekly_trends structure (should be array of 4 items)
            if 'weekly_trends' in data and isinstance(data['weekly_trends'], list):
                if len(data['weekly_trends']) >= 1:
                    trend_fields = ['week', 'start', 'messages', 'active_users', 'new_users']
                    first_trend = data['weekly_trends'][0]
                    for field in trend_fields:
                        if field not in first_trend:
                            missing_fields.append(f'weekly_trends[0].{field}')
            
            # Validate media_insights structure
            if 'media_insights' in data:
                media_fields = ['users_using_media', 'media_adoption_rate', 'avg_media_per_user', 'by_type']
                for field in media_fields:
                    if field not in data['media_insights']:
                        missing_fields.append(f'media_insights.{field}')
            
            # Report validation results
            if missing_fields:
                print(f"❌ Missing fields: {missing_fields}")
                return False
            
            print("✅ All required fields present in insights response")
            
            # Validate data types for key fields
            if 'generated_at' in data:
                try:
                    datetime.fromisoformat(data['generated_at'].replace('Z', '+00:00'))
                    print("✅ generated_at is valid ISO timestamp")
                except:
                    print("❌ generated_at is not valid ISO timestamp")
                    return False
            
            if 'weekly_trends' in data and isinstance(data['weekly_trends'], list):
                print(f"📊 Weekly trends contains {len(data['weekly_trends'])} entries")
            
            if 'top_users' in data and isinstance(data['top_users'], list):
                print(f"👥 Top users list contains {len(data['top_users'])} entries")
            
            return True
            
        elif response.status_code == 403:
            print("❌ Unauthorized access (403) - token may be invalid or expired")
            return False
        else:
            print(f"❌ Request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing admin insights: {str(e)}")
        return False

def test_unauthenticated_access():
    """Test that unauthenticated requests return 403"""
    print("\n=== Testing Unauthenticated Access ===")
    
    endpoints = [
        f"{BASE_URL}/api/admin/metrics",
        f"{BASE_URL}/api/admin/insights"
    ]
    
    all_passed = True
    
    for url in endpoints:
        try:
            print(f"Testing unauthenticated access to: {url}")
            response = requests.get(url)  # No Authorization header
            
            if response.status_code == 403:
                print(f"✅ Correctly returned 403 for {url}")
            else:
                print(f"❌ Expected 403 but got {response.status_code} for {url}")
                all_passed = False
                
        except Exception as e:
            print(f"❌ Error testing {url}: {str(e)}")
            all_passed = False
    
    return all_passed

def main():
    """Run all admin dashboard API tests"""
    print("🚀 Starting Admin Dashboard API Test Suite")
    print(f"Base URL: {BASE_URL}")
    print(f"Using Bearer Token: {BEARER_TOKEN[:20]}...")
    print("=" * 60)
    
    test_results = {
        'admin_metrics': test_admin_metrics(),
        'admin_metrics_date_range': test_admin_metrics_with_date_range(),
        'admin_insights': test_admin_insights(),
        'unauthenticated_access': test_unauthenticated_access()
    }
    
    print("\n" + "=" * 60)
    print("📋 TEST RESULTS SUMMARY:")
    print("=" * 60)
    
    total_tests = len(test_results)
    passed_tests = sum(1 for result in test_results.values() if result)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    print(f"\nOverall Result: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED! Admin Dashboard API endpoints are working correctly.")
        return True
    else:
        print("🚨 SOME TESTS FAILED! Please review the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)