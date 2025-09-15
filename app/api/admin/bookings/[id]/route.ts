// app/api/admin/bookings/[id]/route.ts
export const runtime = "edge";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isAuthed(req: Request) {
  const hdr = req.headers.get("x-admin-token");
  return hdr && hdr === process.env.ADMIN_TOKEN;
}

export async function PATCH(req: Request, { params }: { params: { id: string }}) {
  if (!isAuthed(req)) return new Response("Unauthorized", { status: 401 });

  const id = params.id;
  const body = await req.json().catch(() => ({}));
  const status = (body?.status || "").toString();

  const allowed = new Set(["confirmed","cancelled","rescheduled","no_show"]);
  if (!allowed.has(status)) {
    return new Response("Invalid status", { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ status })
    .eq("id", id);

  if (error) return new Response("DB error", { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" }});
}
