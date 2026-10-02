import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { passcode } = await req.json();
    const expectedPasscode = process.env.TEAM_PASSCODE || 'event2026';

    if (!passcode || passcode.trim() !== expectedPasscode.trim()) {
      return NextResponse.json(
        { success: false, message: 'Invalid team passcode' },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set('team_session', expectedPasscode.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Authentication error' },
      { status: 500 }
    );
  }
}
