import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Helper function: only instantiates when a request actually arrives
function getSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hwimpyhxwwgjyldrekpf.supabase.co";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "build-placeholder-key";

  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { participantId, mode, mealSession, scannerId } = body;

    if (!participantId || typeof participantId !== "string") {
      return NextResponse.json(
        { status: "INVALID", message: "Missing or invalid participantId" },
        { status: 400 }
      );
    }

    const cleanId = participantId.trim();

    if (mode === "registration") {
      const { data, error } = await supabase.rpc("register_attendee", {
        p_id: cleanId,
        scanner_id: scannerId || "desk-scanner",
      });
      if (error) throw error;
      return NextResponse.json(data);
    } else {
      const activeSession =
        mealSession && mealSession.trim() !== "" ? mealSession.trim() : "OCT_08_DINNER";
      const { data, error } = await supabase.rpc("verify_meal_access", {
        p_id: cleanId,
        p_session: activeSession,
        p_scanner_id: scannerId || "gate-scanner",
      });
      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (err: any) {
    console.error("Scan API Error:", err);
    return NextResponse.json(
      { status: "ERROR", message: err.message || "Internal verification error" },
      { status: 500 }
    );
  }
}