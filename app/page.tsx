import Link from "next/link";
import { QrCode, Utensils, ClipboardCheck, ArrowRight, LayoutDashboard, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] bg-neutral-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 text-center relative z-10">
        {/* IEEE CS Brand Header */}
        <div className="flex flex-col items-center">
          <div className="bg-neutral-900/80 p-3 rounded-2xl border border-neutral-800 shadow-xl mb-4 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ieee-cs-logo.png"
              alt="IEEE Computer Society"
              className="h-12 w-auto object-contain brightness-110"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            October 8 – 11 • Verification Active
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white">Event Access Portal</h1>
          <p className="text-neutral-400 text-sm mt-1">Select your gate scanning station</p>
        </div>

        {/* Station Selectors */}
        <div className="space-y-4 pt-2">
          {/* Main Desk Registration */}
          <Link
            href="/scanner?mode=registration"
            className="flex items-center justify-between p-5 bg-neutral-900/90 border border-neutral-800 hover:border-blue-500 rounded-2xl transition group text-left shadow-lg hover:shadow-blue-500/10 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30 group-hover:scale-105 transition-transform">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Station 1</span>
                <h3 className="font-bold text-white text-base">Main Desk Registration</h3>
                <p className="text-xs text-neutral-400 mt-0.5">First-time badge & kit check-in</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-neutral-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
          </Link>

          {/* Dining Gate Access */}
          <Link
            href="/scanner?mode=dinner"
            className="flex items-center justify-between p-5 bg-neutral-900/90 border border-neutral-800 hover:border-emerald-500 rounded-2xl transition group text-left shadow-lg hover:shadow-emerald-500/10 active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/30 group-hover:scale-105 transition-transform">
                <Utensils className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Station 2</span>
                <h3 className="font-bold text-white text-base">Dining Gate Access</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Verify 9 meal sessions (Oct 8–11)</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-neutral-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </Link>
        </div>

        {/* Dashboard Link */}
        <div className="pt-4 border-t border-neutral-800/80">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white px-4 py-2 rounded-xl bg-neutral-900/50 hover:bg-neutral-800 border border-neutral-800 transition"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-neutral-400" />
            Open Organizer Live Dashboard →
          </Link>
        </div>
      </div>
    </main>
  );
}
