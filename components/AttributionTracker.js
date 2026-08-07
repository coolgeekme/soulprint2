'use client';

import { useEffect } from 'react';
import { captureFirstTouchAttribution } from '@/lib/analytics';

export default function AttributionTracker() {
  useEffect(() => {
    captureFirstTouchAttribution();
  }, []);
  return null;
}
