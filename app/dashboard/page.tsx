"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  ClipboardCheck,
  UtensilsCrossed,
  Search,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  ChevronRight,
  Phone,
  Mail,
  Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  MEAL_SESSIONS,
  type EventStats,
  type Participant,
  type MealSessionId,
} from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<EventStats>({
    total: 0,
    registered: 0,
    registeredPercent: 0,
    mealsServedTotal: 0,
    sessionsBreakdown: MEAL_SESSIONS.map((s) => ({
      session: s.id,
      label: s.label,
      day: s.day,
      meal: s.meal,
      count: 0,
      percentOfRegistered: 0,
      percentOfTotal: 0,
    })),
  });

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "REGISTERED" | "NOT_REGISTERED">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Manual meal redemption modal/state
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [selectedMealSession, setSelectedMealSession] = useState<MealSessionId>("OCT_08_DINNER");
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch stats from /api/stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (res.ok) {
        const data: EventStats = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  // Fetch participant list with their meal redemptions
  const fetchParticipants = useCallback(async () => {
    try {
      const res = await fetch("/api/participants", { cache: "no-store" });
      if (res.ok) {
        const data: Participant[] = await res.json();
        setParticipants(data);
      }
    } catch (err) {
      console.error("Failed to fetch participants:", err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStats(), fetchParticipants()]);
    setIsRefreshing(false);
    setIsLoading(false);
  }, [fetchStats, fetchParticipants]);

  useEffect(() => {
    refreshAll();

    // Supabase Realtime subscriptions
    const partChannel = supabase
      .channel("dashboard_realtime_participants")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_participants" },
        () => {
          fetchStats();
          fetchParticipants();
        }
      )
      .subscribe();

    const mealChannel = supabase
      .channel("dashboard_realtime_meals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_redemptions" },
        () => {
          fetchStats();
          fetchParticipants();
        }
      )
      .subscribe();

    // Periodic poll fallback every 8 seconds
    const interval = setInterval(() => {
      fetchStats();
    }, 8000);

    return () => {
      supabase.removeChannel(partChannel);
      supabase.removeChannel(mealChannel);
      clearInterval(interval);
    };
  }, [refreshAll, fetchStats, fetchParticipants]);

  // Manual Main Desk Check-In Action
  const handleManualDeskCheckIn = async (participantId: string) => {
    setActionLoadingId(`desk-${participantId}`);
    setActionMessage(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          mode: "registration",
          scannerId: "dashboard-manual",
        }),
      });
      const data = await res.json();
      if (data.status === "SUCCESS") {
        setActionMessage({
          type: "success",
          text: `Successfully checked in ${data.name} at Main Desk!`,
        });
        await refreshAll();
      } else {
        setActionMessage({
          type: "error",
          text: data.message || `Status: ${data.status}`,
        });
      }
    } catch (err) {
      setActionMessage({
        type: "error",
        text: "Network error during manual check-in.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Manual Meal Redemption Action
  const handleManualMealRedeem = async () => {
    if (!selectedParticipant) return;
    setActionLoadingId(`meal-${selectedParticipant.participant_id}`);
    setActionMessage(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: selectedParticipant.participant_id,
          mode: "dinner",
          mealSession: selectedMealSession,
          scannerId: "dashboard-manual",
        }),
      });
      const data = await res.json();
      if (data.status === "SUCCESS") {
        setActionMessage({
          type: "success",
          text: `Meal ${selectedMealSession} granted for ${data.name}!`,
        });
        setSelectedParticipant(null);
        await refreshAll();
      } else {
        setActionMessage({
          type: "error",
          text: data.message || `Access Denied: ${data.status}`,
        });
      }
    } catch (err) {
      setActionMessage({
        type: "error",
        text: "Network error during meal override.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter participants
  const filteredParticipants = participants.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.mobile_number && p.mobile_number.includes(q)) ||
      p.participant_id.toLowerCase().includes(q) ||
      (p.organization && p.organization.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === "REGISTERED") return p.is_registered;
    if (statusFilter === "NOT_REGISTERED") return !p.is_registered;
    return true;
  });

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-neutral-800/80 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* IEEE CS Brand Logo */}
            <div className="shrink-0 bg-neutral-900/60 p-2.5 rounded-2xl border border-neutral-800/80 shadow-md flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ieee-cs-logo.png"
                alt="IEEE Computer Society"
                className="h-10 sm:h-12 w-auto object-contain brightness-110"
              />
            </div>

            <div>
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Event Verification System
                </span>
                <span className="text-xs text-neutral-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  October 8 – 11
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Organizer Operations Dashboard
              </h1>
              <p className="text-sm text-neutral-400 mt-1">
                Multi-gate live sync, registration desks, and 9 dining sessions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              ← Portal Home
            </Link>
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
              {isRefreshing ? "Syncing…" : "Refresh Live Data"}
            </button>
          </div>
        </header>

        {/* Action Notice Alert */}
        {actionMessage && (
          <div
            className={`p-4 rounded-2xl border text-sm font-medium flex items-center justify-between animate-in fade-in duration-200 ${
              actionMessage.type === "success"
                ? "bg-emerald-950/50 border-emerald-800 text-emerald-200"
                : "bg-rose-950/50 border-rose-800 text-rose-200"
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="text-xs underline hover:opacity-80 ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Section 1: Prominent Scanner Launchers */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Main Desk Registration */}
          <Link
            href="/scanner?mode=registration"
            className="group relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-blue-950/60 via-neutral-900 to-neutral-950 border-2 border-blue-600/30 hover:border-blue-500 transition-all shadow-xl hover:shadow-blue-500/10 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <ClipboardCheck className="w-8 h-8" />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
                Launch Scanner <ArrowRight className="w-4 h-4" />
              </span>
            </div>

            <div className="mt-6">
              <span className="text-[11px] font-bold tracking-wider uppercase text-blue-400">
                Stage 1 Check-In
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5">
                Open Main Desk Registration Scanner
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Scan attendee tickets, issue event badges/kits, and activate meal privileges.
              </p>
            </div>
          </Link>

          {/* Card 2: Dining Gate Verification */}
          <Link
            href="/scanner?mode=dinner"
            className="group relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-amber-950/60 via-neutral-900 to-neutral-950 border-2 border-amber-600/30 hover:border-amber-500 transition-all shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <UtensilsCrossed className="w-8 h-8" />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
                Launch Scanner <ArrowRight className="w-4 h-4" />
              </span>
            </div>

            <div className="mt-6">
              <span className="text-[11px] font-bold tracking-wider uppercase text-amber-400">
                Stage 2 Dining Gate
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5">
                Open Dining Gate Scanner
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Validate meal access across all 9 sessions (Oct 8–11). Blocks duplicate & unregistered scans.
              </p>
            </div>
          </Link>
        </section>

        {/* Section 2: Real-Time Counters & Aggregate Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Tickets */}
          <div className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                Total Tickets
              </p>
              <h3 className="text-2xl font-black text-white">{stats.total}</h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">In database</p>
            </div>
          </div>

          {/* Main Desk Check-Ins */}
          <div className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Desk Check-Ins
                  </p>
                  <h3 className="text-xl font-black text-white">
                    {stats.registered}{" "}
                    <span className="text-xs font-semibold text-blue-400">
                      ({stats.registeredPercent}%)
                    </span>
                  </h3>
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${stats.registeredPercent}%` }}
              />
            </div>
          </div>

          {/* Total Meals Served */}
          <div className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                Total Meals Served
              </p>
              <h3 className="text-2xl font-black text-white">
                {stats.mealsServedTotal}
              </h3>
              <p className="text-[11px] text-neutral-500 mt-0.5">Across all 9 sessions</p>
            </div>
          </div>
        </section>

        {/* Section 3: Live Breakdown of Meals Served Across Oct 8–11 (9 Sessions) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-amber-400" />
                Multi-Day Meal Session Breakdown (Oct 8 – 11)
              </h2>
              <p className="text-xs text-neutral-400">
                Live turnout per meal relative to registered attendees
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {stats.sessionsBreakdown.map((s) => (
              <div
                key={s.session}
                className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                      {s.day}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1.5">{s.meal}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-white">{s.count}</span>
                    <span className="text-xs text-neutral-400 ml-1">served</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span>Turnout of checked-in guests</span>
                    <span className="font-semibold text-amber-300">
                      {s.percentOfRegistered}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, s.percentOfRegistered)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Manual Search Fallback & Guest Management */}
        <section className="space-y-4 pt-4 border-t border-neutral-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-400" />
                Manual Search Fallback & Attendee Directory
              </h2>
              <p className="text-xs text-neutral-400">
                Look up guests by name, phone number, or ID with direct manual overrides
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-xl text-xs">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  statusFilter === "ALL"
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                All ({participants.length})
              </button>
              <button
                onClick={() => setStatusFilter("REGISTERED")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  statusFilter === "REGISTERED"
                    ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Checked-In ({stats.registered})
              </button>
              <button
                onClick={() => setStatusFilter("NOT_REGISTERED")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  statusFilter === "NOT_REGISTERED"
                    ? "bg-rose-600/30 text-rose-300 border border-rose-500/40"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Pending ({stats.total - stats.registered})
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by attendee name, phone number, email, or ticket ID…"
              className="w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Results Table / Cards */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-neutral-400 text-sm">
                Loading attendees…
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-sm">
                No participants found matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-neutral-300">
                  <thead className="bg-neutral-900/90 text-[11px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">Attendee</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Desk Status</th>
                      <th className="px-4 py-3">Meals Redeemed</th>
                      <th className="px-4 py-3 text-right">Manual Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 font-medium">
                    {filteredParticipants.slice(0, 50).map((p) => {
                      const isActing =
                        actionLoadingId === `desk-${p.participant_id}` ||
                        actionLoadingId === `meal-${p.participant_id}`;

                      return (
                        <tr key={p.participant_id} className="hover:bg-neutral-800/30 transition-colors">
                          {/* Attendee */}
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-white text-sm">{p.name}</div>
                            <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-neutral-500">ID: {p.participant_id}</span>
                              {p.organization && (
                                <>
                                  <span>•</span>
                                  <span>{p.organization}</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="px-4 py-3.5">
                            {p.mobile_number && (
                              <div className="flex items-center gap-1 text-neutral-300">
                                <Phone className="w-3 h-3 text-neutral-500" />
                                {p.mobile_number}
                              </div>
                            )}
                            {p.email && (
                              <div className="flex items-center gap-1 text-neutral-400 text-[11px] mt-0.5">
                                <Mail className="w-3 h-3 text-neutral-500" />
                                {p.email}
                              </div>
                            )}
                          </td>

                          {/* Desk Status */}
                          <td className="px-4 py-3.5">
                            {p.is_registered ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 border border-blue-500/30 text-blue-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Checked In
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Meals Redeemed */}
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
                              {p.redemptions ? p.redemptions.length : 0} / 9 meals
                            </span>
                          </td>

                          {/* Manual Override Buttons */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Desk Check-In Button */}
                              <button
                                onClick={() => handleManualDeskCheckIn(p.participant_id)}
                                disabled={p.is_registered || isActing}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:hover:bg-blue-600 disabled:cursor-not-allowed"
                              >
                                {p.is_registered ? "Registered" : "Check In Desk"}
                              </button>

                              {/* Redeem Meal Button */}
                              <button
                                onClick={() => setSelectedParticipant(p)}
                                disabled={!p.is_registered || isActing}
                                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:hover:bg-amber-600 disabled:cursor-not-allowed"
                                title={!p.is_registered ? "Must check in at desk first" : "Grant meal session"}
                              >
                                Redeem Meal…
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Manual Meal Redemption Modal */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Manual Meal Override
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  {selectedParticipant.name}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  ID: {selectedParticipant.participant_id}
                </p>
              </div>
              <button
                onClick={() => setSelectedParticipant(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-300">
                Select Meal Session (Oct 8 – 11):
              </label>
              <select
                value={selectedMealSession}
                onChange={(e) => setSelectedMealSession(e.target.value as MealSessionId)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {MEAL_SESSIONS.map((s) => {
                  const alreadyRedeemed = selectedParticipant.redemptions?.includes(s.id);
                  return (
                    <option key={s.id} value={s.id}>
                      {s.label} {alreadyRedeemed ? "(Already Redeemed)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setSelectedParticipant(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleManualMealRedeem}
                disabled={actionLoadingId !== null}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/30 transition-all"
              >
                {actionLoadingId ? "Processing…" : "Confirm Redemption"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}