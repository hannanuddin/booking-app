// app/admin/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  service_id: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  status: "confirmed" | "cancelled" | "rescheduled" | "no_show";
};

export default function AdminPage() {
  const [token, setToken] = useState<string>("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit] = useState(20);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("ADMIN_TOKEN") || "";
    setToken(t);
  }, []);

  async function load() {
    if (!token) { setErr("Admin token missing"); return; }
    setLoading(true);
    setErr("");
    try {
      const p = new URLSearchParams({
        q, status, page: String(page), limit: String(limit)
      });
      if (dateFrom) p.set("dateFrom", dateFrom);
      if (dateTo) p.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/bookings?${p.toString()}`, {
        headers: { "x-admin-token": token },
        cache: "no-store",
      });
      if (!res.ok) {
        setErr(`Load failed (${res.status})`);
      } else {
        const data = await res.json();
        setRows(data.rows || []);
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page]);

  function saveToken() {
    localStorage.setItem("ADMIN_TOKEN", token);
    load();
  }

  async function updateStatus(id: string, newStatus: Row["status"]) {
    if (!token) return;
    const prev = rows.slice();
    setRows(rows.map(r => r.id === id ? { ...r, status: newStatus } : r));
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setRows(prev);
        alert("Update failed: " + (await res.text()));
      }
    } catch {
      setRows(prev);
      alert("Network error");
    }
  }

  const filtered = useMemo(() => rows, [rows]);

  return (
    <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Admin — Bookings</h1>

      {/* Token Bar */}
      <div style={{ margin: "12px 0", display: "flex", gap: 8 }}>
        <input
          type="password"
          placeholder="Admin token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={saveToken}>Save</button>
      </div>
      {err && <p style={{ color: "crimson" }}>{err}</p>}

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, margin: "12px 0" }}>
        <input placeholder="Search name/email" value={q} onChange={(e)=>setQ(e.target.value)} />
        <select value={status} onChange={(e)=>setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="confirmed">confirmed</option>
          <option value="rescheduled">rescheduled</option>
          <option value="cancelled">cancelled</option>
          <option value="no_show">no_show</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} />
        <input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} />
        <button onClick={() => { setPage(1); load(); }} disabled={loading}>
          {loading ? "Loading..." : "Apply"}
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <th style={th}>Time</th>
              <th style={th}>Service</th>
              <th style={th}>Customer</th>
              <th style={th}>Email</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 16, textAlign: "center" }}>No results</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  {new Date(r.starts_at).toLocaleString([], { hour12: true })}<br/>
                  <small>
                    → {new Date(r.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </small>
                </td>
                <td style={td}>{r.service_name}</td>
                <td style={td}>{r.customer_name}</td>
                <td style={td}>{r.customer_email}</td>
                <td style={td}><b>{r.status}</b></td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => updateStatus(r.id, "confirmed")}>Confirm</button>
                    <button onClick={() => updateStatus(r.id, "cancelled")}>Cancel</button>
                    <button onClick={() => updateStatus(r.id, "rescheduled")}>Rescheduled</button>
                    <button onClick={() => updateStatus(r.id, "no_show")}>No-show</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Prev</button>
        <span>Page {page}</span>
        <button onClick={() => setPage(p => p+1)}>Next</button>
      </div>
    </main>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: 10, borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: 10, borderBottom: "1px solid #f1f5f9" };
