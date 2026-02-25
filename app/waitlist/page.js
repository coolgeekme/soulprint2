'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SoulPrintLogo from '@/components/SoulPrintLogo';

export default function WaitlistPage() {
  const router = useRouter();
  const [botName, setBotName] = useState('SoulPrint');

  useEffect(() => {
    const token = localStorage.getItem('sp_token');
    if (!token) { router.push('/auth'); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.accepted || d.role === 'admin' || d.role === 'superadmin') {
          router.push('/chat');
        }
        if (d.profile?.assistant_name) setBotName(d.profile.assistant_name);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.15)_0%,transparent_70%)]" />

      <div className="relative z-10 max-w-md">
        <SoulPrintLogo size={64} />

        <h1 className="font-condensed font-black text-white text-4xl mt-6 mb-4 uppercase tracking-tight">
          YOU&apos;RE ON THE LIST
        </h1>

        <p className="text-gray-400 text-sm leading-relaxed mb-2">
          Your answers have been saved. Once you&apos;re accepted, log in and <span className="text-orange-400 font-medium">{botName}</span> will be ready and waiting — already knowing exactly who you are.
        </p>

        <div className="my-8 p-6 rounded-2xl" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)' }}>
          <div className="w-3 h-3 rounded-full bg-orange-500 mx-auto mb-3 animate-pulse" />
          <p className="text-orange-300 text-sm font-medium mb-1">Position saved</p>
          <p className="text-gray-500 text-xs">We&apos;ll notify you when access is granted</p>
        </div>

        <Link href="/" className="btn-orange inline-block px-8 py-4 rounded-xl text-sm">
          GOT IT — BACK TO HOME
        </Link>

        <p className="mt-6 text-xs text-gray-600">
          Already accepted? Try <button onClick={() => window.location.reload()} className="text-orange-500 hover:text-orange-400 underline">refreshing</button>
        </p>
      </div>
    </div>
  );
}
