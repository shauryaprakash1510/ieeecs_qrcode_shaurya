import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hwimpyhxwwgjyldrekpf.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'build-placeholder';
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { 
      participantId, 
      name, 
      email, 
      mobileNumber, 
      organization, 
      eventId, 
      mode, 
      mealSession, 
      scannerId 
    } = body;

    if (!participantId || typeof participantId !== 'string') {
      return NextResponse.json(
        { status: 'INVALID', message: 'Missing participant ID' },
        { status: 400 }
      );
    }

    const cleanId = participantId.trim();

    if (mode === 'registration') {
      // Upsert: Create or update attendee record from QR payload
      const { data, error } = await supabase.rpc('register_attendee', {
        p_id: cleanId,
        p_name: name || 'Attendee',
        p_email: email || '',
        p_mobile: mobileNumber || '',
        p_org: organization || '',
        p_event_id: eventId || 'event-2026',
        p_scanner_id: scannerId || 'desk-scanner',
      });

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Dinner mode
      const activeSession = mealSession && mealSession.trim() !== '' ? mealSession.trim() : 'OCT_08_DINNER';
      const { data, error } = await supabase.rpc('verify_meal_access', {
        p_id: cleanId,
        p_session: activeSession,
        p_scanner_id: scannerId || 'gate-scanner',
      });

      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (err: any) {
    console.error('Scan Error:', err);
    return NextResponse.json(
      { status: 'ERROR', message: err.message || 'Internal processing error' },
      { status: 500 }
    );
  }
}