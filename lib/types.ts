// TypeScript types for the Event Check-In & Multi-Day Dining Verification System

/** 9 Meal Sessions across October 8 – 11 */
export const MEAL_SESSIONS = [
  { id: "OCT_08_DINNER", label: "Oct 8 — Dinner", day: "Oct 8", meal: "Dinner", date: "2026-10-08" },
  { id: "OCT_09_BREAKFAST", label: "Oct 9 — Breakfast", day: "Oct 9", meal: "Breakfast", date: "2026-10-09" },
  { id: "OCT_09_LUNCH", label: "Oct 9 — Lunch", day: "Oct 9", meal: "Lunch", date: "2026-10-09" },
  { id: "OCT_09_DINNER", label: "Oct 9 — Dinner", day: "Oct 9", meal: "Dinner", date: "2026-10-09" },
  { id: "OCT_10_BREAKFAST", label: "Oct 10 — Breakfast", day: "Oct 10", meal: "Breakfast", date: "2026-10-10" },
  { id: "OCT_10_LUNCH", label: "Oct 10 — Lunch", day: "Oct 10", meal: "Lunch", date: "2026-10-10" },
  { id: "OCT_10_DINNER", label: "Oct 10 — Dinner", day: "Oct 10", meal: "Dinner", date: "2026-10-10" },
  { id: "OCT_11_BREAKFAST", label: "Oct 11 — Breakfast", day: "Oct 11", meal: "Breakfast", date: "2026-10-11" },
  { id: "OCT_11_LUNCH", label: "Oct 11 — Lunch", day: "Oct 11", meal: "Lunch", date: "2026-10-11" },
] as const;

export type MealSessionId = (typeof MEAL_SESSIONS)[number]["id"];

/** Raw QR payload from the ticketing partner */
export interface QRPayload {
  participantId: string;
  eventId?: string;
  name?: string;
  email?: string;
  mobileNumber?: string;
  organization?: string;
}

/** Scanner operating mode */
export type ScanMode = "registration" | "dinner";

/** All possible scan result statuses */
export type ScanStatus =
  | "SUCCESS"
  | "ALREADY_USED"
  | "ALREADY_REGISTERED"
  | "NOT_REGISTERED"
  | "INVALID"
  | "ERROR";

/** Successful scan result (registration or meal access) */
export interface SuccessResult {
  status: "SUCCESS";
  name: string;
  organization?: string;
  registered_at?: string;
  meal_session?: MealSessionId;
  redeemed_at?: string;
  scanned_at?: string;
}

/** Already registered at desk */
export interface AlreadyRegisteredResult {
  status: "ALREADY_REGISTERED";
  name: string;
  organization?: string;
  registered_at: string;
  scanned_at?: string;
}

/** Already redeemed meal for this session */
export interface AlreadyUsedResult {
  status: "ALREADY_USED";
  name: string;
  organization?: string;
  meal_session: MealSessionId;
  redeemed_at?: string;
  scanned_at?: string;
}

/** Not registered — tried dining without desk check-in */
export interface NotRegisteredResult {
  status: "NOT_REGISTERED";
  name?: string;
  organization?: string;
  meal_session?: MealSessionId;
  message: string;
  scanned_at?: string;
}

/** Invalid / not found */
export interface InvalidResult {
  status: "INVALID";
  message: string;
}

/** Server / network / database error */
export interface ErrorResult {
  status: "ERROR";
  message: string;
}

/** Union of all scan results */
export type ScanResult =
  | SuccessResult
  | AlreadyRegisteredResult
  | AlreadyUsedResult
  | NotRegisteredResult
  | InvalidResult
  | ErrorResult;

/** Request body for POST /api/scan */
export interface ScanRequest {
  participantId: string;
  mode: ScanMode;
  mealSession?: MealSessionId;
  scannerId?: string;
  gateId?: string;
}

/** Meal Session breakdown item */
export interface MealSessionStat {
  session: MealSessionId;
  label: string;
  day: string;
  meal: string;
  count: number;
  percentOfRegistered: number;
  percentOfTotal: number;
}

/** Dashboard stats */
export interface EventStats {
  total: number;
  registered: number;
  registeredPercent: number;
  mealsServedTotal: number;
  sessionsBreakdown: MealSessionStat[];
}

/** Participant row from Supabase */
export interface Participant {
  participant_id: string;
  event_id: string;
  name: string;
  email: string | null;
  mobile_number: string | null;
  organization: string | null;
  is_registered: boolean;
  registered_at: string | null;
  registered_by: string | null;
  created_at?: string;
  redemptions?: string[]; // Array of redeemed meal session IDs
}

/** Meal redemption record */
export interface MealRedemption {
  id: string;
  participant_id: string;
  meal_session: MealSessionId;
  redeemed_at: string;
  scanned_by: string | null;
  gate_id: string | null;
}

/** Scanner identity */
export type ScannerId = "gate-1" | "gate-2" | "gate-3" | "gate-4" | "gate-5";
