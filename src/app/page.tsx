'use client';

import { useState } from 'react';

export default function HomePage() {
  const [count, setCount] = useState(0);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] text-white">
      <h1 className="text-4xl font-bold mb-4">QuantFusion</h1>
      <p className="text-zinc-400 mb-8">AI-Powered Trading Platform</p>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-emerald-400 text-sm">System Online</span>
      </div>
      <div className="mt-8">
        <button 
          onClick={() => setCount(c => c + 1)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg"
        >
          Clicked {count} times
        </button>
      </div>
    </div>
  );
}
