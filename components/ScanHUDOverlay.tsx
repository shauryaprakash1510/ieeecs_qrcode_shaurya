"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Ban, Clock, Sparkles, ArrowRight } from "lucide-react";
import type { ScanResult, ScanMode, MealSessionId } from "@/lib/types";
import { MEAL_SESSIONS } from "@/lib/types";
import { playSuccessChime, playWarningBuzz, playErrorBuzz } from "@/lib/sound";

interface ScanHUDOverlayProps {
  result: ScanResult;
  mode: ScanMode;
  mealSession?: MealSessionId;
  onDismiss: () => void;
}

export default function ScanHUDOverlay({
  result,
  mode,
  mealSession,
  onDismiss,
}: ScanHUDOverlayProps) {
  const soundPlayedRef = useRef(false);

  // Audio and Haptics trigger on initial mount
  useEffect(() => {
    if (soundPlayedRef.current) return;
    soundPlayedRef.current = true;

    const isSuccess = result.status === "SUCCESS" || (result.status as string) === "REGISTRATION_SUCCESS";

    if (isSuccess) {
      playSuccessChime();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } else if (result.status === "ALREADY_REGISTERED" || result.status === "ALREADY_USED") {
      playWarningBuzz();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(250);
      }
    } else {
      // NOT_REGISTERED, INVALID, or ERROR
      playErrorBuzz();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([200, 80, 200]);
      }
    }
  }, [result]);

  const activeSessionInfo = MEAL_SESSIONS.find(
    (s) => s.id === (result as any).meal_session || s.id === mealSession
  );

  // Format timestamp helper
  const formatTime = (ts?: string) => {
    if (!ts) return "Earlier";
    try {
      return new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const timestamp =
    (result as any).scanned_at ||
    (result as any).redeemed_at ||
    (result as any).registered_at;

  const isSuccess = result.status === "SUCCESS" || (result.status as string) === "REGISTRATION_SUCCESS";

  const bgClass =
    isSuccess
      ? "bg-emerald-600 text-white"
      : result.status === "ALREADY_REGISTERED" || result.status === "ALREADY_USED"
      ? "bg-amber-600 text-white"
      : result.status === "NOT_REGISTERED"
      ? "bg-rose-600 text-white"
      : "bg-rose-600 text-white";

  return (
    <div
      onClick={onDismiss}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center select-none touch-none cursor-pointer ${bgClass}`}
    >
      {/* Top Banner Notice with Brand Logo & Tap Hint */}
      <div className="absolute top-5 inset-x-0 flex items-center justify-between px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ieee-cs-logo.png"
          alt="IEEE Computer Society"
          className="h-6 w-auto object-contain brightness-125 drop-shadow-md"
        />
        <span className="text-[11px] font-bold tracking-widest uppercase bg-black/25 px-3 py-1 rounded-full text-white/90 backdrop-blur-sm shadow-sm">
          Verification Result
        </span>
      </div>

      {/* Main Flash Result Center Content */}
      <div className="w-full max-w-sm flex flex-col items-center text-center my-auto">
        {/* SUCCESS */}
        {isSuccess && (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-150">
            <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center mb-5 shadow-2xl animate-bounce">
              <CheckCircle2 className="w-16 h-16 text-white stroke-[2.5]" />
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase drop-shadow-sm mb-2">
              ACCESS GRANTED
            </h1>

            <div className="mt-2 mb-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {(result as any).name}
              </h2>
              {(result as any).organization && (
                <p className="text-base font-semibold text-emerald-100 mt-0.5">
                  {(result as any).organization}
                </p>
              )}
            </div>

            <div className="mt-3 px-3.5 py-1.5 rounded-xl bg-black/20 border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
              {mode === "registration"
                ? "Badge & Kit Verified"
                : `${activeSessionInfo?.label || "Meal Session"} Approved`}
            </div>
          </div>
        )}

        {/* ALREADY REGISTERED / ALREADY USED */}
        {(result.status === "ALREADY_REGISTERED" || result.status === "ALREADY_USED") && (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-150">
            <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center mb-5 shadow-2xl animate-pulse">
              <AlertTriangle className="w-16 h-16 text-white stroke-[2.5]" />
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase drop-shadow-sm mb-2">
              {result.status === "ALREADY_USED" ? "ALREADY SCANNED" : "ALREADY REGISTERED"}
            </h1>

            <div className="mt-2 mb-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {(result as any).name}
              </h2>
              {(result as any).organization && (
                <p className="text-base font-semibold text-amber-100 mt-0.5">
                  {(result as any).organization}
                </p>
              )}
            </div>

            <div className="mt-3 px-3.5 py-1.5 rounded-xl bg-black/20 border border-white/20 text-xs font-bold text-white flex items-center gap-1.5 shadow-inner">
              <Clock className="w-3.5 h-3.5 text-amber-200" />
              {result.status === "ALREADY_USED"
                ? `${activeSessionInfo?.meal || "Meal"} redeemed at ${formatTime(timestamp)}`
                : `Checked in at ${formatTime(timestamp)}`}
            </div>
          </div>
        )}

        {/* NOT REGISTERED */}
        {result.status === "NOT_REGISTERED" && (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-150">
            <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center mb-5 shadow-2xl animate-pulse">
              <Ban className="w-16 h-16 text-white stroke-[2.5]" />
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase drop-shadow-sm mb-1.5">
              NOT REGISTERED
            </h1>

            <div className="mt-1 mb-2 px-3.5 py-1 rounded-xl bg-white/25 border-2 border-white/50 text-base font-black text-white uppercase tracking-wider">
              Send guest to Main Desk
            </div>

            {(result as any).name && (
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                {(result as any).name}
              </h2>
            )}
            {(result as any).organization && (
              <p className="text-xs sm:text-sm font-semibold text-rose-100">
                {(result as any).organization}
              </p>
            )}

            <p className="text-xs text-rose-100 font-medium mt-3 bg-black/20 px-3 py-1.5 rounded-lg border border-white/20 max-w-xs">
              {result.message || "Must check in at the Main Desk before accessing meals."}
            </p>
          </div>
        )}

        {/* INVALID / ERROR */}
        {(result.status === "INVALID" || result.status === "ERROR") && (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-150">
            <div className="w-24 h-24 rounded-full bg-white/20 border-4 border-white flex items-center justify-center mb-5 shadow-2xl">
              <XCircle className="w-16 h-16 text-white stroke-[2.5]" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase drop-shadow-sm mb-2">
              UNRECOGNIZED TICKET
            </h1>

            <div className="mt-2 px-3.5 py-2 rounded-xl bg-black/25 border border-white/20 text-xs sm:text-sm font-medium text-white max-w-xs">
              {result.message || "Ticket not found in the event database."}
            </div>

            <p className="text-[11px] text-white/90 font-semibold mt-3 uppercase tracking-wider">
              Direct guest to Help Desk for lookup
            </p>
          </div>
        )}
      </div>

      {/* Manual Action Button to proceed to Next QR */}
      <div className="absolute bottom-6 inset-x-6 max-w-sm mx-auto flex flex-col items-center gap-2 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="w-full py-4 px-6 rounded-2xl bg-white text-neutral-950 hover:bg-neutral-100 active:scale-[0.98] font-black text-base tracking-wide flex items-center justify-center gap-2.5 shadow-2xl transition-all border border-white/40"
        >
          <span>Next QR</span>
          <ArrowRight className="w-5 h-5 stroke-[2.5]" />
        </button>
        <span className="text-[11px] font-medium text-white/80 tracking-wider">
          Tap anywhere or press Next QR to scan next
        </span>
      </div>
    </div>
  );
}
