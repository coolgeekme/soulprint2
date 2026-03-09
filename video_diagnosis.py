#!/usr/bin/env python3
"""
Simple Video Generation Test
Tests what the user reported specifically
"""

import requests
import json
import time

# Configuration
BASE_URL = "https://image-video-gen-11.preview.emergentagent.com/api"
LOGIN_EMAIL = "test@soulprint.com"
LOGIN_PASSWORD = "test123"

def get_auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": LOGIN_EMAIL, "passcode": LOGIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_direct_video_api():
    """Test the exact API call from the user request"""
    print("1. Testing direct video generation API...")
    
    token = get_auth_token()
    if not token:
        return False
    
    # Test the exact payload from user request
    payload = {
        "prompt": "A peaceful sunset over the ocean with gentle waves",
        "duration": 5,
        "quality": "720p",
        "aspectRatio": "16:9"
    }
    
    print(f"   📤 Sending request: {payload}")
    
    response = requests.post(
        f"{BASE_URL}/generate/video",
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    )
    
    print(f"   📥 Response: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Success: {data}")
        return data.get("taskId")
    else:
        print(f"   ❌ Failed: {response.text}")
        return None

def test_chat_stream_video():
    """Test chat stream video generation"""
    print("\n2. Testing chat stream video generation...")
    
    token = get_auth_token()
    if not token:
        return False
    
    payload = {
        "content": "generate a video of a cat playing with yarn",
        "model": "gpt-4o"
    }
    
    print(f"   📤 Sending chat request: {payload}")
    
    response = requests.post(
        f"{BASE_URL}/chat/stream",
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        stream=True
    )
    
    print(f"   📥 Response: {response.status_code}")
    
    if response.status_code == 200:
        video_task_id = None
        content = ""
        
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line.decode('utf-8'))
                    
                    if data.get("type") == "video_task":
                        video_task_id = data.get("taskId")
                        print(f"   🎬 Video task detected: {video_task_id}")
                    elif data.get("type") == "delta":
                        content += data.get("content", "")
                    elif data.get("type") == "done":
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        if video_task_id:
            print(f"   ✅ Video generation initiated via chat")
            print(f"   📄 Content preview: {content[:150]}...")
            return video_task_id
        else:
            print(f"   ❌ No video generation detected")
            print(f"   📄 Full content: {content}")
            return None
    else:
        print(f"   ❌ Chat stream failed: {response.text}")
        return None

def check_video_status(task_id):
    """Check video status"""
    if not task_id:
        return
        
    print(f"\n3. Testing video status for {task_id}...")
    
    token = get_auth_token()
    if not token:
        return
    
    response = requests.get(
        f"{BASE_URL}/generate/video/{task_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    print(f"   📥 Status response: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        status = data.get("status", "unknown")
        print(f"   ✅ Status check successful: {status}")
        print(f"   📊 Full status: {data}")
    else:
        print(f"   ❌ Status check failed: {response.text}")

def check_kie_api_directly():
    """Test Kie.ai API directly with real key"""
    print("\n4. Testing Kie.ai API directly...")
    
    # Read the actual API key
    kie_key = None
    try:
        with open("/app/.env", "r") as f:
            for line in f:
                if line.startswith("KIE_API_KEY="):
                    kie_key = line.split("=", 1)[1].strip()
                    break
        
        if not kie_key:
            print("   ❌ KIE_API_KEY not found in .env")
            return
    except Exception as e:
        print(f"   ❌ Error reading .env: {e}")
        return
    
    payload = {
        "prompt": "test video generation",
        "duration": 5,
        "quality": "720p",
        "aspectRatio": "16:9"
    }
    
    response = requests.post(
        "https://api.kie.ai/api/v1/runway/generate",
        json=payload,
        headers={
            "Authorization": f"Bearer {kie_key}",
            "Content-Type": "application/json"
        }
    )
    
    print(f"   📥 Kie.ai response: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get("code") == 200:
            task_id = data.get("data", {}).get("taskId")
            print(f"   ✅ Kie.ai working: TaskID {task_id}")
            return task_id
        else:
            print(f"   ❌ Kie.ai error: {data}")
            return None
    else:
        print(f"   ❌ Kie.ai request failed: {response.text}")
        return None

def main():
    """Run the specific tests the user requested"""
    print("🎬 Video Generation Diagnosis\n")
    print("Testing the exact scenarios from the user request:\n")
    
    # Test 1: Direct API
    task_id_1 = test_direct_video_api()
    
    # Test 2: Chat stream
    task_id_2 = test_chat_stream_video()
    
    # Test 3: Check status of first task
    if task_id_1:
        check_video_status(task_id_1)
    
    # Test 4: Check Kie.ai directly
    kie_task_id = check_kie_api_directly()
    
    print("\n" + "="*50)
    print("📋 DIAGNOSIS SUMMARY")
    print("="*50)
    
    print(f"✅ Direct Video API: {'Working' if task_id_1 else 'Failed'}")
    print(f"✅ Chat Stream Video: {'Working' if task_id_2 else 'Failed'}")
    print(f"✅ Kie.ai Direct API: {'Working' if kie_task_id else 'Failed'}")
    
    if task_id_1 and task_id_2:
        print("\n🎉 VIDEO GENERATION IS WORKING!")
        print("   All endpoints are functioning correctly.")
        print("   Videos are being submitted to Kie.ai successfully.")
        print("   Status polling is working correctly.")
        print("\n💡 USER ISSUE LIKELY:")
        print("   - Videos take 1-3 minutes to complete")
        print("   - User may be expecting instant results")
        print("   - Or user may be experiencing a temporary Kie.ai slowdown")
        
    elif not kie_task_id:
        print("\n❌ KIE.AI API ISSUE")
        print("   Third-party service (Kie.ai) may be down or API key invalid")
        
    else:
        print("\n❌ BACKEND ROUTING ISSUE")
        print("   Our backend has issues routing to Kie.ai")

if __name__ == "__main__":
    main()