"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { AlertCircle, Camera, RefreshCw } from "lucide-react";

interface ScannerFeedProps {
  onScanResult: (decodedText: string) => void;
  isLocked: boolean;
  facingMode?: "environment" | "user";
  torchOn?: boolean;
  onTorchSupport?: (supported: boolean) => void;
  className?: string;
}

export default function ScannerFeed({
  onScanResult,
  isLocked,
  facingMode = "environment",
  torchOn = false,
  onTorchSupport,
  className = "",
}: ScannerFeedProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const lastScannedRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  const DEBOUNCE_MS = 1500;

  const handleScan = useCallback(
    (decodedText: string) => {
      if (isLocked) return;

      const now = Date.now();
      if (
        decodedText === lastScannedRef.current &&
        now - lastScannedTimeRef.current < DEBOUNCE_MS
      ) {
        return;
      }

      lastScannedRef.current = decodedText;
      lastScannedTimeRef.current = now;
      onScanResult(decodedText);
    },
    [isLocked, onScanResult]
  );

  // Check and report torch capability
  const inspectTorchCapability = useCallback(() => {
    try {
      const video = document.querySelector("#qr-reader video") as HTMLVideoElement | null;
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track && track.getCapabilities) {
          const caps = track.getCapabilities() as any;
          const hasTorch = Boolean(caps && caps.torch);
          onTorchSupport?.(hasTorch);
          return;
        }
      }
    } catch {
      // Ignore capability inspection error
    }
    onTorchSupport?.(false);
  }, [onTorchSupport]);

  // Apply torch state to the active video track
  useEffect(() => {
    const applyTorch = async () => {
      try {
        const video = document.querySelector("#qr-reader video") as HTMLVideoElement | null;
        if (video && video.srcObject) {
          const stream = video.srcObject as MediaStream;
          const track = stream.getVideoTracks()[0];
          if (track && track.applyConstraints) {
            const caps = (track.getCapabilities && track.getCapabilities()) || {};
            if ((caps as any).torch) {
              await track.applyConstraints({
                advanced: [{ torch: torchOn } as any],
              });
              return;
            }
          }
        }

        // Secondary fallback to Html5Qrcode API
        if (scannerRef.current) {
          await (scannerRef.current as any).applyVideoConstraints({
            advanced: [{ torch: torchOn }],
          });
        }
      } catch (err) {
        console.warn("Torch constraint could not be applied:", err);
      }
    };

    applyTorch();
  }, [torchOn]);

  // Start or restart scanner when facingMode changes
  useEffect(() => {
    isMountedRef.current = true;
    const elementId = "qr-reader";

    async function startScanner() {
      try {
        setIsStarting(true);
        setCameraError(null);

        // Stop prior instance if any
        if (scannerRef.current) {
          try {
            const state = scannerRef.current.getState();
            if (
              state === Html5QrcodeScannerState.SCANNING ||
              state === Html5QrcodeScannerState.PAUSED
            ) {
              await scannerRef.current.stop();
            }
            await scannerRef.current.clear();
          } catch {
            // Ignore stop errors on unmount
          }
          scannerRef.current = null;
        }

        await new Promise((r) => setTimeout(r, 80));
        if (!isMountedRef.current) return;

        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode },
          {
            fps: 20,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              return { width: minEdge, height: minEdge };
            },
            aspectRatio: 1.0,
            disableFlip: false,
          },
          (decodedText) => {
            if (isMountedRef.current) handleScan(decodedText);
          },
          () => {
            // Ignore non-QR frames
          }
        );

        if (isMountedRef.current) {
          setIsStarting(false);
          setTimeout(inspectTorchCapability, 500);
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        setIsStarting(false);

        const errorMsg = err instanceof Error ? err.message : String(err);
        if (
          errorMsg.includes("NotAllowedError") ||
          errorMsg.includes("Permission")
        ) {
          setCameraError(
            "Camera permission denied. Tap Reload or allow camera access in browser settings."
          );
        } else if (
          errorMsg.includes("NotFoundError") ||
          errorMsg.includes("no camera")
        ) {
          setCameraError("No camera found on this device.");
        } else {
          setCameraError(`Camera error: ${errorMsg}`);
        }
      }
    }

    startScanner();

    return () => {
      isMountedRef.current = false;
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          const state = scanner.getState();
          if (
            state === Html5QrcodeScannerState.SCANNING ||
            state === Html5QrcodeScannerState.PAUSED
          ) {
            scanner.stop().catch(() => {});
          }
        } catch {
          // Scanner already stopped
        }
      }
    };
  }, [facingMode, handleScan, inspectTorchCapability]);

  // Pause / resume camera on lock state changes
  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      const state = scanner.getState();
      if (isLocked && state === Html5QrcodeScannerState.SCANNING) {
        scanner.pause(true);
      } else if (!isLocked && state === Html5QrcodeScannerState.PAUSED) {
        scanner.resume();
      }
    } catch {
      // Ignore state errors during rapid lock/unlock
    }
  }, [isLocked]);

  if (cameraError) {
    return (
      <div className={`flex flex-col items-center justify-center p-4 text-center ${className}`}>
        <div className="w-[85vw] max-w-[340px] aspect-square rounded-3xl bg-neutral-900/90 border border-neutral-800 p-6 flex flex-col items-center justify-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1.5">Camera Unavailable</h3>
          <p className="text-xs text-neutral-400 leading-relaxed mb-4">{cameraError}</p>
          <button
            onClick={() => window.location.reload()}
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Camera
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {/* 2. Scanner Target: w-[85vw] max-w-[340px] aspect-square rounded-3xl overflow-hidden border-2 border-emerald-500/30 shadow-2xl relative */}
      <div className="relative w-[85vw] max-w-[340px] aspect-square rounded-3xl overflow-hidden border-2 border-emerald-500/30 shadow-2xl bg-neutral-950">
        {/* Loading Placeholder */}
        {isStarting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-neutral-950">
            <div className="relative flex items-center justify-center mb-3">
              <div className="w-14 h-14 border-3 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
              <Camera className="w-5 h-5 text-emerald-400 absolute" />
            </div>
            <p className="text-xs font-bold text-white">Starting Viewfinder…</p>
            <p className="text-[10px] text-neutral-500 mt-0.5">Calibrating optical sensor</p>
          </div>
        )}

        {/* html5-qrcode Video Target */}
        <div
          id="qr-reader"
          className="w-full h-full object-cover flex items-center justify-center"
        />

        {/* Center Reticle Corner Accents & Sweep Line */}
        {!isStarting && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Corner Markers */}
            <div className="absolute top-3 left-3 w-7 h-7 border-t-3 border-l-3 border-emerald-400 rounded-tl-xl" />
            <div className="absolute top-3 right-3 w-7 h-7 border-t-3 border-r-3 border-emerald-400 rounded-tr-xl" />
            <div className="absolute bottom-3 left-3 w-7 h-7 border-b-3 border-l-3 border-emerald-400 rounded-bl-xl" />
            <div className="absolute bottom-3 right-3 w-7 h-7 border-b-3 border-r-3 border-emerald-400 rounded-br-xl" />

            {/* Subtle Animated Sweep Line */}
            {!isLocked && <div className="scanner-laser-line" />}
          </div>
        )}

        {/* Processing Indicator */}
        {isLocked && !isStarting && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-25">
            <div className="px-4 py-2 rounded-full bg-neutral-900 border border-emerald-500/60 shadow-2xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-bold text-white tracking-wide">
                Verifying…
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Subtext Guideline */}
      <p className="text-[11px] font-medium text-neutral-400 mt-3 text-center tracking-wide">
        Align ticket QR code inside viewfinder
      </p>
    </div>
  );
}
