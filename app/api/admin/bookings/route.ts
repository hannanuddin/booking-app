// app/api/admin/bookings/route.ts
export const runtime = "edge";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isAuthed(req: Request) {
  const hdr = req.headers.get("x-admin-token");
  return hdr && hdr === process.env.ADMIN_TOKEN;
}

export async function GET(req: Request) {
  if (!isAuthed(req)) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";              // search by name/email
  const status = searchParams.get("status") || "";    // confirmed/cancelled/rescheduled
  const dateFrom = searchParams.get("dateFrom");      // YYYY-MM-DD
  const dateTo = searchParams.get("dateTo");          // YYYY-MM-DD
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabaseAdmin
    .from("bookings")
    .select("id,service_id,starts_at,ends_at,customer_name,customer_email,status")
    .order("starts_at", { ascending: false })
    .range(from, to);

  if (q) {
    // name/email ilike
    query = query.or(`customer_name.ilike.%${q}%,customer_email.ilike.%${q}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (dateFrom) {
    query = query.gte("starts_at", new Date(`${dateFrom}T00:00:00Z`).toISOString());
  }
  if (dateTo) {
    query = query.lte("starts_at", new Date(`${dateTo}T23:59:59Z`).toISOString());
  }

  const { data, error, count } = await query;
  if (error) return new Response("DB error", { status: 500 });

  // services ম্যাপ আনছি (id -> name) আলাদা কলে
  const { data: services } = await supabaseAdmin
    .from("services")
    .select("id,name");

  const map = new Map((services || []).map(s => [s.id, s.name]));
  const rows = (data || []).map(b => ({
    ...b,
    service_name: map.get(b.service_id) || b.service_id,
  }));

  return new Response(JSON.stringify({ rows, page, limit, total: count ?? null }), {
    headers: { "Content-Type": "application/json" },
  });
}
