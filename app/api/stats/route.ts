import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { MEAL_SESSIONS, type EventStats, type MealSessionStat } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // 1. Total participants
    const { count: total, error: totalErr } = await supabase
      .from("event_participants")
      .select("*", { count: "exact", head: true });

    if (totalErr) throw totalErr;

    // 2. Registered participants
    const { count: registered, error: regErr } = await supabase
      .from("event_participants")
      .select("*", { count: "exact", head: true })
      .eq("is_registered", true);

    if (regErr) throw regErr;

    // 3. Meal redemptions breakdown
    const { data: redemptions, error: redErr } = await supabase
      .from("meal_redemptions")
      .select("meal_session");

    if (redErr && redErr.code !== "42P01") {
      // If table exists but error occurs, throw
      console.warn("Meal redemptions query error:", redErr);
    }

    const totalCount = total ?? 0;
    const registeredCount = registered ?? 0;
    const registeredPercent =
      totalCount > 0 ? Math.round((registeredCount / totalCount) * 100) : 0;

    // Count redemptions by session
    const sessionCounts: Record<string, number> = {};
    if (redemptions) {
      for (const r of redemptions) {
        sessionCounts[r.meal_session] = (sessionCounts[r.meal_session] || 0) + 1;
      }
    }

    const mealsServedTotal = redemptions ? redemptions.length : 0;

    const sessionsBreakdown: MealSessionStat[] = MEAL_SESSIONS.map((session) => {
      const count = sessionCounts[session.id] || 0;
      return {
        session: session.id,
        label: session.label,
        day: session.day,
        meal: session.meal,
        count,
        percentOfRegistered:
          registeredCount > 0 ? Math.round((count / registeredCount) * 100) : 0,
        percentOfTotal:
          totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
      };
    });

    const stats: EventStats = {
      total: totalCount,
      registered: registeredCount,
      registeredPercent,
      mealsServedTotal,
      sessionsBreakdown,
    };

    return NextResponse.json(stats);
  } catch (err) {
    console.error("Stats API error:", err);
    return NextResponse.json(
      {
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
      } satisfies EventStats,
      { status: 500 }
    );
  }
}
