"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Zap,
  ZapOff,
  Search,
  ChevronDown,
  X,
  Keyboard,
  Phone,
  Mail,
  UtensilsCrossed,
} from "lucide-react";
import dynamicComponent from "next/dynamic";
import ScanHUDOverlay from "@/components/ScanHUDOverlay";
import { initAudio } from "@/lib/sound";

const ScannerFeed = dynamicComponent(() => import("@/components/ScannerFeed"), {
  ssr: false,
  loading: () => (
    <div className="w-[85vw] max-w-[340px] aspect-square rounded-3xl bg-neutral-950 border-2 border-emerald-500/20 flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mb-2" />
      <p className="text-xs font-bold text-neutral-300">Loading Camera…</p>
    </div>
  ),
});
import {
  MEAL_SESSIONS,
  type ScanMode,
  type ScanResult,
  type MealSessionId,
  type ScannerId,
  type Participant,
} from "@/lib/types";

function ScannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Mode state: 'registration' or 'dinner'
  const initialMode = (searchParams.get("mode") as ScanMode) || "dinner";
  const [mode, setMode] = useState<ScanMode>(
    initialMode === "registration" ? "registration" : "dinner"
  );

  // Active meal session for dining mode (default: OCT_08_DINNER)
  const [mealSession, setMealSession] = useState<MealSessionId>("OCT_08_DINNER");
  const activeSessionObj = MEAL_SESSIONS.find((s) => s.id === mealSession);

  // Scanner identifier
  const [scannerId] = useState<ScannerId>("gate-1");

  // In-place scan result overlay & lock state
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  // Camera & hardware controls
  const [torchOn, setTorchOn] = useState(false);

  // Manual search & attendee directory state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [directoryParticipants, setDirectoryParticipants] = useState<Participant[]>([]);
  const [isDirectoryLoading, setIsDirectoryLoading] = useState(false);

  // Sync mode with URL if searchParams change
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    if (urlMode === "registration" || urlMode === "dinner") {
      setMode(urlMode);
    }
  }, [searchParams]);

  // Handle mode change
  const handleModeChange = (newMode: ScanMode) => {
    setMode(newMode);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", newMode);
    window.history.replaceState({}, "", url.toString());
  };

  // Offline sync queue state
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);

  // Sync offline queue when connection is restored
  const syncPendingScans = useCallback(async () => {
    try {
      const { flushOfflineQueue, getOfflineQueueCount } = await import("@/lib/offline");
      await flushOfflineQueue();
      const count = await getOfflineQueueCount();
      setOfflinePendingCount(count);
    } catch {
      // Ignore background sync errors
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      syncPendingScans();
    };

    window.addEventListener("online", handleOnline);
    syncPendingScans();

    const interval = setInterval(syncPendingScans, 15000);
    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, [syncPendingScans]);

  /**
   * Safely extract ticket data from the ticketing partner's JSON payload or raw text
   */
  const parseQRPayload = (
    raw: string
  ): { participantId: string; name?: string; organization?: string } => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.participantId === "string" && parsed.participantId.trim()) {
        return {
          participantId: parsed.participantId.trim(),
          name: typeof parsed.name === "string" ? parsed.name.trim() : undefined,
          organization: typeof parsed.organization === "string" ? parsed.organization.trim() : undefined,
        };
      }
    } catch {
      // Raw string fallback
    }
    return { participantId: raw.trim() };
  };

  /**
   * Process a scanned or manually entered participant ID with online RPC and offline queue fallback
   */
  const processVerification = useCallback(
    async (rawId: string) => {
      if (isLocked) return;

      setIsLocked(true);
      initAudio();

      const qrData = parseQRPayload(rawId);
      const participantId = qrData.participantId;

      if (!participantId) {
        setScanResult({
          status: "INVALID",
          message: "Missing or invalid participant ticket ID in QR",
        });
        return;
      }

      const scanRequest = {
        participantId,
        mode,
        mealSession: mode === "dinner" ? mealSession : undefined,
        scannerId,
      };

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scanRequest),
        });

        const data: ScanResult = await res.json();
        setScanResult(data);

        if (data.status === "SUCCESS") {
          setScanCount((prev) => prev + 1);
        }
      } catch (err: any) {
        console.warn("Scan network error — storing in offline sync queue:", err);

        // Offline storage fallback using idb
        try {
          const { enqueueOfflineScan, getOfflineQueueCount } = await import("@/lib/offline");
          await enqueueOfflineScan(scanRequest);
          const count = await getOfflineQueueCount();
          setOfflinePendingCount(count);

          setScanResult({
            status: "SUCCESS",
            name: qrData.name || "Offline Ticket",
            organization: qrData.organization || "Queued for Sync",
            meal_session: mode === "dinner" ? mealSession : undefined,
          });
          setScanCount((prev) => prev + 1);
        } catch {
          setScanResult({
            status: "ERROR",
            message: "Network unreachable and local storage failed",
          });
        }
      }
    },
    [isLocked, mode, mealSession, scannerId]
  );

  /**
   * Handle camera scan result
   */
  const handleScanResult = useCallback(
    (decodedText: string) => {
      processVerification(decodedText);
    },
    [processVerification]
  );

  // Fetch directory of attendees from /api/participants
  const fetchDirectory = useCallback(async (query: string) => {
    setIsDirectoryLoading(true);
    try {
      const q = query.trim();
      const url = q ? `/api/participants?query=${encodeURIComponent(q)}` : `/api/participants`;
      const res = await fetch(url);
      if (res.ok) {
        const data: Participant[] = await res.json();
        setDirectoryParticipants(data);
      }
    } catch (err) {
      console.error("Directory search error:", err);
    } finally {
      setIsDirectoryLoading(false);
    }
  }, []);

  // Fetch or filter directory when modal opens or searchQuery changes
  useEffect(() => {
    if (!isManualModalOpen) return;
    const timeout = setTimeout(() => {
      fetchDirectory(searchQuery);
    }, 150);
    return () => clearTimeout(timeout);
  }, [isManualModalOpen, searchQuery, fetchDirectory]);

  /**
   * Dismiss HUD overlay and resume scanning immediately
   */
  const handleDismissOverlay = useCallback(() => {
    setScanResult(null);
    setIsLocked(false);
  }, []);

  return (
    <div
      className="fixed inset-0 h-[100dvh] w-full overflow-hidden select-none touch-none overscroll-none bg-black flex flex-col justify-between font-sans"
      onClick={() => initAudio()}
      onTouchStart={() => initAudio()}
    >
      {/* 3. Top bar (sticky): Back button, IEEE CS Logo, mode/session selector dropdown, and shift scan counter */}
      <header className="sticky top-0 inset-x-0 z-30 pt-[max(0.75rem,env(safe-area-inset-top))] px-3 pb-2.5 bg-neutral-950/90 border-b border-neutral-900/80 backdrop-blur-md flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {/* Back Button & Brand Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-300 active:scale-95 transition-all shadow-sm"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-neutral-400" />
              <span>Back</span>
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ieee-cs-logo.png"
              alt="IEEE Computer Society"
              className="h-6 sm:h-7 w-auto object-contain brightness-110"
            />
          </div>

          {/* Shift Scan Counter Badge & Offline Queue Status */}
          <div className="flex items-center gap-1.5 shrink-0">
            {offlinePendingCount > 0 && (
              <span className="px-2 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300 animate-pulse">
                Syncing: {offlinePendingCount}
              </span>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-semibold text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-white tracking-wide">
                {scanCount}
              </span>
            </div>
          </div>
        </div>

        {/* Mode / Session Selector Dropdown */}
        <div className="relative w-full">
          <select
            value={mode === "registration" ? "registration" : mealSession}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "registration") {
                handleModeChange("registration");
              } else {
                handleModeChange("dinner");
                setMealSession(val as MealSessionId);
              }
            }}
            className="w-full appearance-none bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-xl px-3 py-2 pr-8 text-xs font-bold truncate focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm cursor-pointer"
          >
            <option value="registration" className="bg-neutral-900 text-white font-semibold">
              📋 Registration Desk
            </option>
            <optgroup label="🍽️ Dining Sessions" className="bg-neutral-900 text-neutral-400 font-bold">
              {MEAL_SESSIONS.map((session) => (
                <option
                  key={session.id}
                  value={session.id}
                  className="bg-neutral-900 text-neutral-100 font-semibold"
                >
                  🍽️ {session.label}
                </option>
              ))}
            </optgroup>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </header>

      {/* 2 & 3. Center area: Centered square camera reticle with subtle animated sweep line */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 relative overflow-hidden">
        <ScannerFeed
          onScanResult={handleScanResult}
          isLocked={isLocked}
          facingMode="environment"
          torchOn={torchOn}
        />
      </main>

      {/* 3. Bottom bar: Quick-tap torch toggle and manual search trigger within one-thumb reach */}
      <footer className="sticky bottom-0 inset-x-0 z-30 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 px-4 bg-neutral-950/90 border-t border-neutral-900/80 backdrop-blur-md flex items-center justify-center gap-3">
        {/* Quick-tap Torch Toggle */}
        <button
          onClick={() => setTorchOn((prev) => !prev)}
          className={`flex-1 max-w-[170px] h-12 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md ${
            torchOn
              ? "bg-amber-500 text-black border-2 border-amber-300 shadow-amber-500/20"
              : "bg-neutral-900 text-neutral-200 border border-neutral-800 hover:bg-neutral-800"
          }`}
        >
          {torchOn ? (
            <>
              <Zap className="w-4 h-4 text-black fill-black" />
              <span>Torch ON</span>
            </>
          ) : (
            <>
              <ZapOff className="w-4 h-4 text-neutral-400" />
              <span>Torch OFF</span>
            </>
          )}
        </button>

        {/* Manual Search Trigger */}
        <button
          onClick={() => setIsManualModalOpen(true)}
          className="flex-1 max-w-[170px] h-12 rounded-2xl bg-neutral-900 text-neutral-200 border border-neutral-800 hover:bg-neutral-800 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider shadow-md"
        >
          <Search className="w-4 h-4 text-emerald-400" />
          <span>Manual Search</span>
        </button>
      </footer>

      {/* Manual Search & Attendee Directory Modal */}
      {isManualModalOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 select-text touch-auto"
          onClick={() => setIsManualModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[82vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Title and Close */}
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-950/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    Attendee Directory & Manual Override
                  </h3>
                  <p className="text-[11px] text-neutral-400 leading-tight">
                    Search by name, phone number, or ID
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Search Input Bar */}
            <div className="p-3 border-b border-neutral-800 shrink-0 bg-neutral-900">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, phone (+91...), email, or ticket ID…"
                  autoFocus
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Attendee Directory Results List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 overscroll-contain">
              {isDirectoryLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Searching attendee directory…</span>
                </div>
              ) : directoryParticipants.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-center px-4">
                  <p className="text-xs text-neutral-400 mb-3">
                    {searchQuery
                      ? `No guests found matching "${searchQuery}"`
                      : "No attendees found in the system."}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setIsManualModalOpen(false);
                        processVerification(searchQuery.trim());
                      }}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      Verify &quot;{searchQuery}&quot; as Raw Ticket ID
                    </button>
                  )}
                </div>
              ) : (
                directoryParticipants.map((p) => {
                  const hasRedeemed = p.redemptions && p.redemptions.includes(mealSession);
                  return (
                    <div
                      key={p.participant_id}
                      className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800/80 hover:border-neutral-700 transition-all flex flex-col gap-2 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white truncate">
                              {p.name}
                            </span>
                            {p.is_registered ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                Checked In
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700 shrink-0">
                                Unregistered
                              </span>
                            )}
                          </div>

                          {p.organization && (
                            <p className="text-xs text-neutral-400 mt-0.5 truncate">
                              {p.organization}
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-neutral-400 flex-wrap">
                            {p.mobile_number && (
                              <span className="flex items-center gap-1 font-mono text-neutral-300">
                                <Phone className="w-3 h-3 text-neutral-500" />
                                {p.mobile_number}
                              </span>
                            )}
                            <span className="font-mono text-neutral-500 text-[10px]">
                              ID: {p.participant_id}
                            </span>
                          </div>
                        </div>

                        {/* Direct Manual Override Button */}
                        <div className="shrink-0 flex items-center pt-0.5">
                          {mode === "registration" ? (
                            <button
                              onClick={() => {
                                setIsManualModalOpen(false);
                                processVerification(p.participant_id);
                              }}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                                p.is_registered
                                  ? "bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30"
                                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"
                              }`}
                            >
                              {p.is_registered ? "Re-Verify" : "Check In"}
                            </button>
                          ) : (
                            /* Dining Mode */
                            <button
                              onClick={() => {
                                setIsManualModalOpen(false);
                                processVerification(p.participant_id);
                              }}
                              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                                !p.is_registered
                                  ? "bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30"
                                  : hasRedeemed
                                  ? "bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30"
                                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30"
                              }`}
                            >
                              {!p.is_registered
                                ? "Desk Check-In Req."
                                : hasRedeemed
                                ? "Already Used"
                                : "Grant Meal"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Dining Session indicator for Dining Mode */}
                      {mode === "dinner" && (
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-900 text-[11px]">
                          <span className="text-neutral-400 flex items-center gap-1 font-medium">
                            <UtensilsCrossed className="w-3 h-3 text-amber-500" />
                            {activeSessionObj?.label}
                          </span>
                          <span
                            className={`font-semibold ${
                              hasRedeemed ? "text-amber-400" : "text-emerald-400"
                            }`}
                          >
                            {hasRedeemed ? "Redeemed for this session" : "Meal privilege available"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Summary / Quick Actions */}
            <div className="p-3 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 shrink-0">
              <span className="font-medium">
                {directoryParticipants.length} guest{directoryParticipants.length === 1 ? "" : "s"} shown
              </span>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-neutral-800 text-neutral-200 hover:bg-neutral-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. In-Place HUD Overlay (Strictly fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center) */}
      {scanResult && (
        <ScanHUDOverlay
          result={scanResult}
          mode={mode}
          mealSession={mealSession}
          onDismiss={handleDismissOverlay}
          autoDismissMs={2000}
        />
      )}
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 h-[100dvh] w-full bg-black flex items-center justify-center text-neutral-400 text-xs font-bold">
          Loading Scanner…
        </div>
      }
    >
      <ScannerContent />
    </Suspense>
  );
}
