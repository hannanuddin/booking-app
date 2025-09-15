// app/api/book/route.ts
export const runtime = "edge";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Edge-safe ইমেইল সেন্ডার (Resend API ব্যবহার করে)
async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL || "onboarding@resend.dev";
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Resend error: ${res.status} ${txt}`);
  }
}

export async function POST(req: Request) {
  try {
    const { serviceId, start, name, email } = (await req.json()) as {
      serviceId: string;
      start: string;
      name: string;
      email: string;
    };

    if (!serviceId || !start || !name || !email) {
      return new Response("Bad request", { status: 400 });
    }

    // সার্ভিস ডিউরেশন আনো
    const { data: svc, error: svcErr } = await supabaseAdmin
      .from("services")
      .select("name,duration_minutes")
      .eq("id", serviceId)
      .maybeSingle();

    if (svcErr) {
      console.error("Service error:", svcErr);
      return new Response("DB error", { status: 500 });
    }
    if (!svc) return new Response("Service not found", { status: 404 });

    const startsAt = new Date(start);
    const endsAt = new Date(
      startsAt.getTime() + svc.duration_minutes * 60 * 1000
    );

    // বুকিং ইনসার্ট + cancel_token রিটার্ন
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        service_id: serviceId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        customer_name: name,
        customer_email: email,
        status: "confirmed",
      })
      .select("cancel_token")
      .single();

    if (insErr) {
      if ((insErr as any).code === "23P01") {
        return new Response("Overlap", { status: 409 });
      }
      console.error("Insert error:", insErr);
      return new Response("DB error", { status: 500 });
    }

    const cancelToken = inserted?.cancel_token;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // ✅ ইমেইল পাঠাও (Cancel + Reschedule লিঙ্কসহ)
    try {
      await sendEmail({
        to: email,
        subject: `Booking confirmed: ${svc.name}`,
        html: `
          <div style="font-family:system-ui">
            <h2>ধন্যবাদ, ${name}!</h2>
            <p>আপনার <b>${svc.name}</b> বুকিং কনফার্ম হয়েছে।</p>
            <p>সময়: ${startsAt.toLocaleString()} — ${endsAt.toLocaleString()}</p>
            <p>
              <a href="${baseUrl}/api/cancel?token=${cancelToken}">
                ❌ বুকিং ক্যানসেল করতে এখানে ক্লিক করুন
              </a>
            </p>
            <p>
              <a href="${baseUrl}/reschedule?token=${cancelToken}">
                ⏰ বুকিং রিশিডিউল করতে এখানে ক্লিক করুন
              </a>
            </p>
            <p style="color:#666">এই ইমেইলটি স্বয়ংক্রিয়ভাবে প্রেরিত।</p>
          </div>
        `,
      });
    } catch (e) {
      console.error("Email send failed:", e);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 201,
    });
  } catch (e) {
    console.error("Book API error:", e);
    return new Response("Server error", { status: 500 });
  }
}
