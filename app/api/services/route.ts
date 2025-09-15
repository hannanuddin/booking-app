// app/api/services/route.ts
export const runtime = "edge";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("services")
    .select("id,name,duration_minutes")
    .order("name");
  if (error) return new Response("DB error", { status: 500 });
  return new Response(JSON.stringify({ services: data }), {
    headers: { "Content-Type": "application/json" },
  });
}
