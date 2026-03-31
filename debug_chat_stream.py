#!/usr/bin/env python3
"""
Debug Script for Image Generation in Chat Stream
"""

import requests
import json
import time

# Configuration
BASE_URL = "https://gemini-voice-fix.preview.emergentagent.com"
AUTH_EMAIL = "test@soulprint.com"
AUTH_PASSWORD = "test123"

def debug_chat_stream():
    session = requests.Session()
    
    # Authenticate
    print("🔐 Authenticating...")
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": AUTH_EMAIL,
        "passcode": AUTH_PASSWORD
    })
    
    if response.status_code != 200:
        print(f"❌ Auth failed: {response.status_code}")
        return
    
    token = response.json().get('token')
    session.headers.update({'Authorization': f'Bearer {token}'})
    print("✅ Authenticated")
    
    # Create conversation
    response = session.post(f"{BASE_URL}/api/conversations", json={
        "title": "Debug Test"
    })
    
    if response.status_code != 200:
        print(f"❌ Conversation creation failed: {response.status_code}")
        return
    
    conversation_id = response.json().get('id')
    print(f"✅ Conversation created: {conversation_id}")
    
    # Test image generation
    print("\n🎨 Testing image generation...")
    response = session.post(f"{BASE_URL}/api/chat/stream", json={
        "content": "generate a picture of a mountain",
        "conversationId": conversation_id,
        "model": "gpt-4o",
        "imageModel": "flux-pro"
    }, stream=True)
    
    print(f"Response status: {response.status_code}")
    print(f"Response headers: {dict(response.headers)}")
    
    if response.status_code == 200:
        print("\n📡 SSE Stream Events:")
        event_count = 0
        
        for line in response.iter_lines(decode_unicode=True):
            if not line:
                continue
            
            event_count += 1
            print(f"Event {event_count}: {line}")
            
            if line.startswith('data: '):
                continue
                
            try:
                data = json.loads(line)
                event_type = data.get('type', 'unknown')
                print(f"  → Type: {event_type}")
                
                if event_type == 'generating_visual':
                    print(f"  → Visual Type: {data.get('visualType')}")
                    print(f"  → Image Model: {data.get('imageModel')}")
                elif event_type == 'image':
                    print(f"  → Image URL: {data.get('url', 'N/A')[:80]}...")
                    print(f"  → Model: {data.get('model', 'N/A')}")
                elif event_type == 'done':
                    print("  → Stream completed")
                    break
                    
            except json.JSONDecodeError as e:
                print(f"  → JSON decode error: {e}")
            
            # Limit output
            if event_count > 20:
                print("  → (truncated after 20 events)")
                break
    else:
        print(f"❌ Stream failed: {response.text}")

if __name__ == "__main__":
    debug_chat_stream()