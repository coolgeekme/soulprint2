#!/usr/bin/env python3
"""
Debug Script for Image Generation with More Explicit Prompts
"""

import requests
import json
import time

# Configuration
BASE_URL = "https://smart-gen-6.preview.emergentagent.com"
AUTH_EMAIL = "test@soulprint.com"
AUTH_PASSWORD = "test123"

def test_explicit_image_prompts():
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
        "title": "Debug Image Test"
    })
    
    if response.status_code != 200:
        print(f"❌ Conversation creation failed: {response.status_code}")
        return
    
    conversation_id = response.json().get('id')
    print(f"✅ Conversation created: {conversation_id}")
    
    # Test different image generation prompts
    test_prompts = [
        "create an image of a mountain",
        "generate image: mountain landscape",
        "make an image showing a mountain",
        "draw a picture of a mountain",
        "I want to see an image of a mountain"
    ]
    
    for i, prompt in enumerate(test_prompts, 1):
        print(f"\n🎨 Test {i}: '{prompt}'")
        
        response = session.post(f"{BASE_URL}/api/chat/stream", json={
            "content": prompt,
            "conversationId": conversation_id,
            "model": "gpt-4o",
            "imageModel": "flux-pro"
        }, stream=True)
        
        if response.status_code == 200:
            image_generation_found = False
            
            for line in response.iter_lines(decode_unicode=True):
                if not line:
                    continue
                    
                try:
                    data = json.loads(line)
                    event_type = data.get('type', 'unknown')
                    
                    if event_type == 'generating_visual':
                        visual_type = data.get('visualType')
                        if visual_type == 'image':
                            image_generation_found = True
                            print(f"  ✅ Image generation triggered!")
                            print(f"  📊 Image Model: {data.get('imageModel', 'N/A')}")
                            break
                    elif event_type == 'image':
                        if not image_generation_found:
                            image_generation_found = True
                            print(f"  ✅ Image generated!")
                            print(f"  📊 Model: {data.get('model', 'N/A')}")
                            print(f"  🔗 URL: {data.get('url', 'N/A')[:80]}...")
                        break
                    elif event_type == 'done':
                        break
                        
                except json.JSONDecodeError:
                    continue
            
            if not image_generation_found:
                print("  ❌ No image generation detected")
        else:
            print(f"  ❌ Request failed: {response.status_code}")
        
        time.sleep(2)

if __name__ == "__main__":
    test_explicit_image_prompts()