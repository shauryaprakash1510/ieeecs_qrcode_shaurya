// app/page.tsx
import Link from 'next/link';
import { QrCode, Utensils, ClipboardCheck, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <div className="inline-flex p-3 bg-blue-500/10 text-blue-400 rounded-2xl mb-4">
            <QrCode className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Event Access Portal</h1>
          <p className="text-slate-400 text-sm mt-1">Select your gate scanning station</p>
        </div>

        <div className="space-y-4 pt-2">
          {/* Main Desk Registration */}
          <Link
            href="/scanner?mode=registration"
            className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 hover:border-blue-500 rounded-2xl transition group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Main Desk Registration</h3>
                <p className="text-xs text-slate-400">First-time badge & kit check-in</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition" />
          </Link>

          {/* Dining Gate Access */}
          <Link
            href="/scanner?mode=dinner"
            className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 hover:border-emerald-500 rounded-2xl transition group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-xl">
                <Utensils className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Dining Gate Access</h3>
                <p className="text-xs text-slate-400">Verify meal session entry</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition" />
          </Link>
        </div>

        <div className="pt-4">
          <Link
            href="/dashboard"
            className="text-xs text-slate-500 hover:text-slate-300 transition"
          >
            Open Organizer Live Dashboard →
          </Link>
        </div>
      </div>
    </main>
  );
}