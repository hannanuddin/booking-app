// app/api/cancel/route.ts
export const runtime = "edge";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("cancel_token", token);

  if (error) {
    console.error("Cancel error:", error);
    return new Response("DB error", { status: 500 });
  }

  return new Response("Booking cancelled ✅", {
    headers: { "Content-Type": "text/plain" },
  });
}
