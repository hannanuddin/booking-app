// app/api/slots/route.ts
export const runtime = "edge";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * বুকিং স্লট জেনারেশনের টাইমজোন।
 * .env.local এ BOOKING_TZ_OFFSET সেট করতে পারো (যেমন "+06:00" ঢাকার জন্য)।
 */
const TZ_OFFSET = process.env.BOOKING_TZ_OFFSET || "+06:00";

/**
 * Supabase "time" কলাম সাধারণত "HH:MM:SS" দেয় (কখনও ".ffffff" থাকে)।
 * আবার কারো স্কিমায় "HH:MM" থাকতে পারে—দুটোই হ্যান্ডেল করি।
 * রিটার্ন: JS Date যেটা ওই date+time-কে TZ_OFFSET অনুযায়ী লোকাল ধরে তৈরি করা।
 */
function toDateTime(dateStr: string, rawTime: string | null) {
  const raw = (rawTime ?? "").toString();
  const noFrac = raw.split(".")[0]; // "10:00:00.000000" -> "10:00:00"

  const hhmmss =
    noFrac.length === 5 ? `${noFrac}:00` : // "10:00" -> "10:00:00"
    noFrac.length === 8 ? noFrac :        // "10:00:00"
    "00:00:00";

  // উদাহরণ: 2025-09-15T10:00:00+06:00
  return new Date(`${dateStr}T${hhmmss}${TZ_OFFSET}`);
}

/**
 * নির্দিষ্ট date (YYYY-MM-DD) এর "লোকাল-মিডনাইট" (TZ_OFFSET অনুযায়ী) তৈরির হেল্পার।
 */
function dayBounds(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00${TZ_OFFSET}`);
  const end   = new Date(`${dateStr}T23:59:59${TZ_OFFSET}`);
  return { start, end };
}

/**
 * TZ_OFFSET অনুযায়ী ওই date-এর weekday বের করি।
 * JS-এ 0=Sun..6=Sat; আমাদের টেবিলেও এই স্কিমা ধরেছি।
 */
function weekdayFor(dateStr: string) {
  return new Date(`${dateStr}T00:00:00${TZ_OFFSET}`).getUTCDay();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId");
    const date = searchParams.get("date"); // YYYY-MM-DD (e.g., "2025-10-16")

    if (!serviceId || !date) {
      return new Response(JSON.stringify({ slots: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 1) সার্ভিস ডিউরেশন আনো
    const { data: svc, error: svcErr } = await supabaseAdmin
      .from("services")
      .select("id,duration_minutes")
      .eq("id", serviceId)
      .maybeSingle();

    if (svcErr) {
      console.error("[SLOTS] service error:", svcErr);
      return new Response("DB error", { status: 500 });
    }
    if (!svc) {
      return new Response(JSON.stringify({ slots: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2) ওই date-এর weekday (TZ offset অনুযায়ী)
    const weekday = weekdayFor(date);

    // 3) ঐ দিনের availability আনো
    const { data: avails, error: avErr } = await supabaseAdmin
      .from("availability")
      .select("start_time,end_time")
      .eq("service_id", serviceId)
      .eq("weekday", weekday);

    if (avErr) {
      console.error("[SLOTS] availability error:", avErr);
      return new Response("DB error", { status: 500 });
    }
    if (!avails || avails.length === 0) {
      return new Response(JSON.stringify({ slots: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 4) ঐ দিনের বুকিং (busy রেঞ্জ) আনো
    const { start: dayStart, end: dayEnd } = dayBounds(date);

    const { data: booked, error: bkErr } = await supabaseAdmin
      .from("bookings")
      .select("starts_at,ends_at")
      .eq("service_id", serviceId)
      .gte("starts_at", dayStart.toISOString())
      .lte("starts_at", dayEnd.toISOString());

    if (bkErr) {
      console.error("[SLOTS] bookings error:", bkErr);
      return new Response("DB error", { status: 500 });
    }

    const busy = (booked || []).map((b) => ({
      start: new Date(b.starts_at),
      end: new Date(b.ends_at),
    }));

    // 5) স্লট জেনারেশন
    const slots: { start: string; end: string }[] = [];
    const durMs = svc.duration_minutes * 60 * 1000;

    for (const a of avails) {
      let t = toDateTime(date, (a as any).start_time);
      const availEnd = toDateTime(date, (a as any).end_time);

      // invalid হলে স্কিপ
      if (isNaN(t.getTime()) || isNaN(availEnd.getTime())) continue;

      while (true) {
        const slotStart = new Date(t);
        const slotEnd = new Date(t.getTime() + durMs);
        if (slotEnd > availEnd) break;

        // ওভারল্যাপ চেক
        const overlaps = busy.some(
          (b) => !(slotEnd <= b.start || slotStart >= b.end)
        );

        if (!overlaps) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
          });
        }
        t = slotEnd; // পরের স্লট
      }
    }

    return new Response(JSON.stringify({ slots }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("[SLOTS] unhandled error:", e);
    return new Response("Server error", { status: 500 });
  }
}
