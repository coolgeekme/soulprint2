'use client';

import React, { useState, useRef } from 'react';

export default function TestCompositePage() {
  const [baseImage, setBaseImage] = useState(null);
  const [overlayImage, setOverlayImage] = useState(null);
  const [basePreview, setBasePreview] = useState('');
  const [overlayPreview, setOverlayPreview] = useState('');
  const [instruction, setInstruction] = useState('Place this logo on the product');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [placementData, setPlacementData] = useState(null);
  
  const baseRef = useRef(null);
  const overlayRef = useRef(null);

  const handleFileSelect = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      if (type === 'base') {
        setBaseImage(dataUrl);
        setBasePreview(dataUrl);
      } else {
        setOverlayImage(dataUrl);
        setOverlayPreview(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleComposite = async () => {
    if (!baseImage || !overlayImage) {
      setError('Please select both a base image and an overlay image');
      return;
    }
    
    setLoading(true);
    setError('');
    setResult(null);
    setPlacementData(null);
    
    try {
      // Get auth token
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@soulprint.com', password: 'test123' }),
      });
      const loginData = await loginRes.json();
      const token = loginData.token;
      
      if (!token) {
        setError('Authentication failed');
        setLoading(false);
        return;
      }
      
      const res = await fetch('/api/composite/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          baseImage: baseImage,
          overlayImage: overlayImage,
          instruction: instruction,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setResult(data.url);
        setPlacementData(data.placement);
      } else {
        setError(data.error || 'Compositing failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Smart Composite Test</h1>
        <p className="text-gray-400 mb-8">
          AI provides placement intelligence only — your logo pixels are preserved exactly.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Base Image */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-3">Base Image (Product/Scene)</h2>
            <div 
              className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors min-h-[200px] flex items-center justify-center"
              onClick={() => baseRef.current?.click()}
            >
              {basePreview ? (
                <img src={basePreview} alt="Base" className="max-h-[300px] rounded object-contain" />
              ) : (
                <div className="text-gray-500">
                  <p className="text-4xl mb-2">🖼️</p>
                  <p>Click to select base image</p>
                </div>
              )}
            </div>
            <input 
              ref={baseRef}
              type="file" 
              accept="image/*" 
              onChange={(e) => handleFileSelect(e, 'base')}
              className="hidden"
            />
          </div>
          
          {/* Overlay Image */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-3">Logo / Design (Overlay)</h2>
            <div 
              className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-green-500 transition-colors min-h-[200px] flex items-center justify-center"
              onClick={() => overlayRef.current?.click()}
            >
              {overlayPreview ? (
                <img src={overlayPreview} alt="Overlay" className="max-h-[300px] rounded object-contain" />
              ) : (
                <div className="text-gray-500">
                  <p className="text-4xl mb-2">🎨</p>
                  <p>Click to select logo/design</p>
                </div>
              )}
            </div>
            <input 
              ref={overlayRef}
              type="file" 
              accept="image/*" 
              onChange={(e) => handleFileSelect(e, 'overlay')}
              className="hidden"
            />
          </div>
          
          {/* Result */}
          <div className="bg-gray-800 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-3">Result</h2>
            <div className="border-2 border-gray-600 rounded-lg p-4 text-center min-h-[200px] flex items-center justify-center">
              {loading ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
                  <p className="text-gray-400">Compositing... (AI analyzing placement)</p>
                </div>
              ) : result ? (
                <img src={result} alt="Result" className="max-h-[300px] rounded object-contain" />
              ) : (
                <div className="text-gray-500">
                  <p className="text-4xl mb-2">✨</p>
                  <p>Result will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Controls */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Instruction</label>
              <input 
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                className="w-full bg-gray-700 rounded-lg px-4 py-3 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="e.g., Place this logo on the side of the van"
              />
            </div>
            <button
              onClick={handleComposite}
              disabled={loading || !baseImage || !overlayImage}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {loading ? 'Compositing...' : '🎨 Composite'}
            </button>
          </div>
        </div>
        
        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-4 mb-6">
            <p className="text-red-300">❌ {error}</p>
          </div>
        )}
        
        {/* Placement Data */}
        {placementData && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-3">AI Placement Analysis</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-400">Position</p>
                <p className="font-mono">x: {placementData.x_percent}%, y: {placementData.y_percent}%</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-400">Size</p>
                <p className="font-mono">w: {placementData.width_percent}%, h: {placementData.height_percent}%</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-400">Surface Type</p>
                <p className="font-mono capitalize">{placementData.surface_type}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-400">Rotation</p>
                <p className="font-mono">{placementData.rotation_degrees}°</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-400">Opacity</p>
                <p className="font-mono">{placementData.opacity}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-400">BG Removed</p>
                <p className="font-mono">{placementData.remove_background ? 'Yes' : 'No'}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-400">BG Color</p>
                <p className="font-mono capitalize">{placementData.background_color}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="text-xs text-gray-400">Method</p>
                <p className="font-mono text-green-400">Pixel-Perfect</p>
              </div>
            </div>
          </div>
        )}
        
        {/* How it works */}
        <div className="mt-8 bg-gray-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-3">How Smart Composite Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-400">
            <div className="flex items-start gap-2">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="text-white font-medium">1. AI Placement Analysis</p>
                <p>GPT-4o Vision analyzes both images and returns precise placement coordinates, surface type, and blend recommendations.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-2xl">🧹</span>
              <div>
                <p className="text-white font-medium">2. Logo Preprocessing</p>
                <p>Background removal (if needed), resizing to fit the target area, and rotation adjustment — all programmatically.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-2xl">✨</span>
              <div>
                <p className="text-white font-medium">3. Pixel-Perfect Composite</p>
                <p>Sharp composites the exact logo pixels onto the base image. AI never touches your logo — it stays 100% original.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
