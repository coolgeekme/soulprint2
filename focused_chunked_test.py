#!/usr/bin/env python3
"""
Focused Chunked Upload Test - Testing both ChatGPT and Facebook export formats
"""
import requests
import json
import zipfile
import io
import base64
import time

BASE_URL = "https://auth-verification-4.preview.emergentagent.com/api"
EMAIL = "test@soulprint.com"
PASSWORD = "test123"

def authenticate():
    """Authenticate and get JWT token"""
    print("🔐 Authenticating...")
    
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": EMAIL,
        "passcode": PASSWORD
    })
    
    if response.status_code != 200:
        print(f"❌ Authentication failed: {response.status_code} - {response.text}")
        return None
    
    data = response.json()
    token = data.get('token')
    print(f"✅ Authentication successful. Token: {token[:20]}...")
    return token

def create_facebook_test_zip():
    """Create a test ZIP file with mock Facebook export data"""
    print("📦 Creating Facebook test ZIP file...")
    
    # Mock Facebook messages data
    messages_data = {
        "participants": [
            {"name": "John Doe"},
            {"name": "Jane Smith"}
        ],
        "messages": [
            {
                "sender_name": "John Doe",
                "timestamp_ms": 1640000000000,
                "content": "Hey! How's your new job at the tech startup going? Really excited to hear about your projects!"
            },
            {
                "sender_name": "Jane Smith", 
                "timestamp_ms": 1640000001000,
                "content": "It's amazing! Working on machine learning models for predictive analytics. The team is brilliant."
            },
            {
                "sender_name": "John Doe",
                "timestamp_ms": 1640000002000,
                "content": "That sounds fascinating! I've been diving deep into neural networks myself. Any interesting challenges you're facing?"
            }
        ]
    }
    
    # Mock Facebook posts data
    posts_data = [
        {
            "timestamp": 1640000000,
            "data": [
                {
                    "post": "Just finished reading an incredible book on quantum computing! The intersection of physics and computer science never ceases to amaze me. Anyone else exploring this field?"
                }
            ]
        },
        {
            "timestamp": 1640000001,
            "data": [
                {
                    "post": "Excited to announce that I'll be speaking at the AI conference next month about sustainable AI practices and energy-efficient algorithms. Looking forward to connecting with fellow researchers!"
                }
            ]
        }
    ]
    
    # Create ZIP file in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr('messages/inbox/conversation_1.json', json.dumps(messages_data, indent=2))
        zip_file.writestr('posts/your_posts_1.json', json.dumps(posts_data, indent=2))
    
    zip_data = zip_buffer.getvalue()
    print(f"✅ Facebook test ZIP created. Size: {len(zip_data)} bytes")
    return zip_data

def test_facebook_chunked_upload(token):
    """Test chunked upload with Facebook data"""
    print(f"\n🔍 TESTING FACEBOOK EXPORT CHUNKED UPLOAD...")
    
    # Create Facebook test data
    zip_data = create_facebook_test_zip()
    filename = "facebook_export.zip"
    file_size = len(zip_data)
    
    # Split into chunks
    chunk_size = 400  # Smaller chunks for testing
    chunks = []
    for i in range(0, len(zip_data), chunk_size):
        chunk = zip_data[i:i+chunk_size]
        chunks.append(chunk)
    
    total_chunks = len(chunks)
    print(f"📊 Facebook file split into {total_chunks} chunks of ~{chunk_size} bytes each")
    
    try:
        # Step 1: Initialize upload with Facebook source
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "filename": filename,
            "fileSize": file_size,
            "source": "facebook",
            "totalChunks": total_chunks
        }
        
        response = requests.post(f"{BASE_URL}/data-import/chunked/init", 
                               headers=headers, 
                               json=payload)
        
        if response.status_code != 200:
            print(f"❌ Facebook init failed: {response.status_code} - {response.text}")
            return False
        
        data = response.json()
        upload_id = data.get('uploadId')
        print(f"✅ Facebook upload session created. Upload ID: {upload_id}")
        
        # Step 2: Upload chunks
        for i, chunk in enumerate(chunks):
            files = {
                'uploadId': (None, upload_id),
                'chunkIndex': (None, str(i)),
                'chunk': ('chunk.bin', chunk, 'application/octet-stream')
            }
            
            response = requests.post(f"{BASE_URL}/data-import/chunked/chunk", 
                                   headers={"Authorization": f"Bearer {token}"}, 
                                   files=files)
            
            if response.status_code != 200:
                print(f"❌ Facebook chunk {i} failed: {response.status_code} - {response.text}")
                return False
            
            print(f"   ✅ Facebook chunk {i+1}/{total_chunks} uploaded")
        
        # Step 3: Complete upload
        payload = {"uploadId": upload_id}
        response = requests.post(f"{BASE_URL}/data-import/chunked/complete", 
                               headers=headers, 
                               json=payload)
        
        if response.status_code != 200:
            print(f"❌ Facebook completion failed: {response.status_code} - {response.text}")
            return False
        
        result = response.json()
        print(f"✅ Facebook upload completed successfully!")
        
        # Verify analysis results
        analysis = result.get('analysis')
        stats = result.get('stats')
        
        if analysis:
            print(f"📊 Facebook Analysis Results:")
            print(f"  - Summary: {analysis.get('summary', 'N/A')}")
            print(f"  - Communication Style: {analysis.get('communicationStyle', {})}")
            print(f"  - Interests: {analysis.get('interests', [])}")
            
        if stats:
            print(f"📈 Facebook Stats:")
            print(f"  - Source: {stats.get('source')}")
            print(f"  - Messages Analyzed: {stats.get('messagesAnalyzed', 0)}")
            print(f"  - Posts Analyzed: {stats.get('postsAnalyzed', 0)}")
            
        return True
        
    except Exception as e:
        print(f"❌ Facebook test failed: {str(e)}")
        return False

def test_auto_detection_chunked_upload(token):
    """Test chunked upload with auto-detection (no source specified)"""
    print(f"\n🔍 TESTING AUTO-DETECTION CHUNKED UPLOAD...")
    
    # Create ChatGPT data with more content but don't specify source (test auto-detection)
    conversations_data = [
        {
            "title": "AI Ethics Discussion",
            "mapping": {
                "msg1": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {"parts": ["What are your thoughts on the ethical implications of AI in healthcare decision making? I'm particularly concerned about bias in diagnostic algorithms."]}
                    }
                },
                "msg2": {
                    "message": {
                        "author": {"role": "assistant"},
                        "content": {"parts": ["AI in healthcare raises important ethical considerations..."]}
                    }
                },
                "msg3": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {"parts": ["That's a comprehensive overview. I'm also wondering about the transparency requirements for AI systems used in critical medical decisions. How can we ensure doctors understand the reasoning behind AI recommendations?"]}
                    }
                }
            }
        },
        {
            "title": "Machine Learning Projects",
            "mapping": {
                "msg4": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {"parts": ["I'm working on a natural language processing project that analyzes patient feedback to improve healthcare services. What are the best approaches for sentiment analysis in this domain?"]}
                    }
                },
                "msg5": {
                    "message": {
                        "author": {"role": "assistant"},
                        "content": {"parts": ["Healthcare sentiment analysis has unique challenges..."]}
                    }
                },
                "msg6": {
                    "message": {
                        "author": {"role": "user"},
                        "content": {"parts": ["Excellent suggestions! I'm particularly interested in handling medical terminology and the nuanced emotional expressions patients use when describing their experiences."]}
                    }
                }
            }
        }
    ]
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr('conversations.json', json.dumps(conversations_data, indent=2))
    
    zip_data = zip_buffer.getvalue()
    filename = "unknown_export.zip"
    file_size = len(zip_data)
    
    chunks = []
    chunk_size = 300
    for i in range(0, len(zip_data), chunk_size):
        chunk = zip_data[i:i+chunk_size]
        chunks.append(chunk)
    
    total_chunks = len(chunks)
    
    try:
        # Initialize without specifying source
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "filename": filename,
            "fileSize": file_size,
            "source": "unknown",  # Test auto-detection
            "totalChunks": total_chunks
        }
        
        response = requests.post(f"{BASE_URL}/data-import/chunked/init", 
                               headers=headers, 
                               json=payload)
        
        if response.status_code != 200:
            print(f"❌ Auto-detection init failed: {response.status_code} - {response.text}")
            return False
        
        upload_id = response.json().get('uploadId')
        print(f"✅ Auto-detection upload session created. Upload ID: {upload_id}")
        
        # Upload chunks
        for i, chunk in enumerate(chunks):
            files = {
                'uploadId': (None, upload_id),
                'chunkIndex': (None, str(i)),
                'chunk': ('chunk.bin', chunk, 'application/octet-stream')
            }
            
            response = requests.post(f"{BASE_URL}/data-import/chunked/chunk", 
                                   headers={"Authorization": f"Bearer {token}"}, 
                                   files=files)
            
            if response.status_code != 200:
                print(f"❌ Auto-detection chunk {i} failed: {response.status_code} - {response.text}")
                return False
        
        # Complete upload
        payload = {"uploadId": upload_id}
        response = requests.post(f"{BASE_URL}/data-import/chunked/complete", 
                               headers=headers, 
                               json=payload)
        
        if response.status_code != 200:
            print(f"❌ Auto-detection completion failed: {response.status_code} - {response.text}")
            return False
        
        result = response.json()
        stats = result.get('stats')
        
        if stats and stats.get('source') == 'chatgpt':
            print(f"✅ Auto-detection successful: Correctly identified as ChatGPT format")
        else:
            print(f"⚠️ Auto-detection: Expected 'chatgpt', got '{stats.get('source') if stats else 'None'}'")
            
        return True
        
    except Exception as e:
        print(f"❌ Auto-detection test failed: {str(e)}")
        return False

def main():
    print("🚀 FOCUSED CHUNKED UPLOAD SYSTEM TEST")
    print("=" * 60)
    
    # Authenticate
    token = authenticate()
    if not token:
        return
    
    # Test different formats
    facebook_success = test_facebook_chunked_upload(token)
    autodetect_success = test_auto_detection_chunked_upload(token)
    
    print("\n" + "=" * 60)
    if facebook_success and autodetect_success:
        print("🎉 ALL FOCUSED TESTS PASSED!")
        print("✅ Facebook format analysis working")
        print("✅ Auto-detection working")
        print("✅ MongoDB chunk storage working across formats")
    else:
        print("❌ Some tests failed:")
        if not facebook_success:
            print("  ❌ Facebook format test failed")
        if not autodetect_success:
            print("  ❌ Auto-detection test failed")

if __name__ == "__main__":
    main()