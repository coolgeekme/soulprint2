#!/usr/bin/env python3
"""
Detailed Smart Mode Classification Testing
Tests the classifyQueryForSmartMode function behavior
"""

import requests
import json

# Configuration
BASE_URL = "https://chat-to-canvas.preview.emergentagent.com/api"
LOGIN_EMAIL = "test@soulprint.com"
LOGIN_PASSWORD = "test123"

def authenticate():
    """Get authentication token"""
    login_data = {"email": LOGIN_EMAIL, "passcode": LOGIN_PASSWORD}
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    return response.json().get('token')

def test_smart_mode_chat_stream():
    """Test Smart Mode in chat stream endpoint"""
    print("🧠 TESTING SMART MODE IN CHAT STREAM")
    print("=" * 50)
    
    token = authenticate()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Test different query types that should trigger different models
    test_cases = [
        {
            "name": "Coding Query",
            "content": "Write a Python function to debug this error",
            "expected_trigger": "coding-related"
        },
        {
            "name": "News Query", 
            "content": "What's the latest news about AI today?",
            "expected_trigger": "real-time info"
        },
        {
            "name": "Creative Query",
            "content": "Write a creative story about space exploration",
            "expected_trigger": "creative writing"
        },
        {
            "name": "Math Query",
            "content": "Calculate the derivative of x^2 + 3x + 2",
            "expected_trigger": "math/analysis"
        }
    ]
    
    for test_case in test_cases:
        print(f"\n📝 Testing: {test_case['name']}")
        
        # Test with model='smart' to trigger classification
        chat_data = {
            "content": test_case["content"],
            "model": "smart",
            "conversationId": None
        }
        
        try:
            response = requests.post(f"{BASE_URL}/chat/stream", 
                                   headers=headers, 
                                   json=chat_data, 
                                   stream=True)
            
            if response.status_code == 200:
                # Read first chunk to get metadata
                first_chunk = None
                for line in response.iter_lines(decode_unicode=True):
                    if line.strip():
                        try:
                            first_chunk = json.loads(line)
                            break
                        except:
                            continue
                
                if first_chunk and first_chunk.get('type') == 'meta':
                    if first_chunk.get('smartMode'):
                        selected_model = first_chunk.get('selectedModel')
                        reason = first_chunk.get('modelReason')
                        print(f"   ✅ Smart Mode activated")
                        print(f"   📊 Selected Model: {selected_model}")
                        print(f"   🎯 Reason: {reason}")
                    else:
                        print(f"   ⚠️  Smart Mode not detected in response")
                else:
                    print(f"   ❌ No valid meta chunk received")
            else:
                print(f"   ❌ Request failed: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")

def test_telegram_model_options():
    """Test that Telegram model command includes Smart Mode"""
    print("\n🤖 TESTING TELEGRAM MODEL OPTIONS")
    print("=" * 50)
    
    # The model options are shown when /model command is used
    # We can't directly test Telegram webhook, but we can verify the model validation logic
    
    token = authenticate()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    valid_models = ['smart', 'gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-5-20250929', 'sonar-pro']
    
    for model in valid_models:
        print(f"\n📋 Testing model: {model}")
        
        model_data = {"model": model}
        response = requests.put(f"{BASE_URL}/telegram/model", headers=headers, json=model_data)
        
        if response.status_code == 400:
            result = response.json()
            error_msg = result.get('error', result.get('message', ''))
            
            if 'No linked Telegram account' in error_msg:
                print(f"   ✅ Model '{model}' recognized (no Telegram account)")
            elif 'Unknown model' in error_msg:
                print(f"   ❌ Model '{model}' not recognized")
            else:
                print(f"   ⚠️  Unexpected error: {error_msg}")
        elif response.status_code == 200:
            result = response.json()
            print(f"   ✅ Model '{model}' accepted: {result}")
        else:
            print(f"   ❌ Unexpected status: {response.status_code}")

def main():
    """Run detailed Smart Mode tests"""
    print("🔍 DETAILED SMART MODE TESTING")
    print("=" * 60)
    
    # Test 1: Smart Mode in chat stream
    test_smart_mode_chat_stream()
    
    # Test 2: Telegram model validation
    test_telegram_model_options()
    
    print("\n" + "=" * 60)
    print("📋 DETAILED TESTING COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    main()