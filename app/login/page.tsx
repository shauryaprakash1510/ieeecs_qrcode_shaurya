'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push(redirect);
        router.refresh();
      } else {
        setError(data.message || 'Incorrect passcode');
      }
    } catch {
      setError('Network connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="fixed inset-0 h-[100dvh] w-full bg-slate-950 text-white flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Team Gate Access</h1>
          <p className="text-xs text-slate-400">
            Enter team passcode to access gate scanner and dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter team passcode"
              autoFocus
              className="w-full px-4 py-3.5 bg-slate-900 border border-slate-800 rounded-xl text-center text-lg tracking-widest font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
            />
            {error && (
              <div className="flex items-center justify-center gap-1.5 text-rose-400 text-xs font-medium pt-1">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-xl text-sm transition cursor-pointer"
          >
            {loading ? 'Checking...' : 'Unlock System'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
