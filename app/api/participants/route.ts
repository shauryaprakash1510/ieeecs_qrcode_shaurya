import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Participant } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") || "").trim().toLowerCase();
    const status = searchParams.get("status") || "ALL";

    const supabase = createServerSupabaseClient();

    // Query participants using service role key (bypasses RLS)
    let dbQuery = supabase
      .from("event_participants")
      .select("*")
      .order("name", { ascending: true })
      .limit(100);

    if (query) {
      // Search across name, mobile_number, participant_id, email, organization
      dbQuery = dbQuery.or(
        `name.ilike.%${query}%,mobile_number.ilike.%${query}%,participant_id.ilike.%${query}%,email.ilike.%${query}%,organization.ilike.%${query}%`
      );
    }

    if (status === "REGISTERED") {
      dbQuery = dbQuery.eq("is_registered", true);
    } else if (status === "NOT_REGISTERED") {
      dbQuery = dbQuery.eq("is_registered", false);
    }

    const { data: partData, error: partErr } = await dbQuery;

    if (partErr) {
      console.error("Error fetching participants:", partErr);
      throw partErr;
    }

    // Fetch redemptions to annotate participants
    const { data: redData } = await supabase
      .from("meal_redemptions")
      .select("participant_id, meal_session");

    const redemptionMap: Record<string, string[]> = {};
    if (redData) {
      for (const r of redData) {
        if (!redemptionMap[r.participant_id]) {
          redemptionMap[r.participant_id] = [];
        }
        redemptionMap[r.participant_id].push(r.meal_session);
      }
    }

    const enriched: Participant[] = (partData || []).map((p: any) => ({
      ...p,
      redemptions: redemptionMap[p.participant_id] || [],
    }));

    return NextResponse.json(enriched);
  } catch (err: any) {
    console.error("API /api/participants error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load attendees" },
      { status: 500 }
    );
  }
}
