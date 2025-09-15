// app/api/reschedule/route.ts
export const runtime = "edge";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { token, newStart } = (await req.json()) as {
      token: string;
      newStart: string;
    };

    if (!token || !newStart) {
      return new Response("Missing token or newStart", { status: 400 });
    }

    // বুকিং খুঁজে আনো
    const { data: booking, error: bErr } = await supabaseAdmin
      .from("bookings")
      .select("id, service_id")
      .eq("cancel_token", token)
      .maybeSingle();

    if (bErr) {
      console.error("Reschedule fetch error:", bErr);
      return new Response("DB error", { status: 500 });
    }
    if (!booking) return new Response("Booking not found", { status: 404 });

    // সার্ভিস ডিউরেশন আনো
    const { data: svc, error: sErr } = await supabaseAdmin
      .from("services")
      .select("duration_minutes")
      .eq("id", booking.service_id)
      .maybeSingle();

    if (sErr || !svc) {
      console.error("Reschedule service error:", sErr);
      return new Response("Service not found", { status: 404 });
    }

    const startsAt = new Date(newStart);
    const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60 * 1000);

    // আপডেট করো
    const { error: uErr } = await supabaseAdmin
      .from("bookings")
      .update({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "rescheduled",
      })
      .eq("cancel_token", token);

    if (uErr) {
      console.error("Reschedule update error:", uErr);
      return new Response("DB error", { status: 500 });
    }

    return new Response("Booking rescheduled ✅", { status: 200 });
  } catch (e) {
    console.error("Reschedule API error:", e);
    return new Response("Server error", { status: 500 });
  }
}
