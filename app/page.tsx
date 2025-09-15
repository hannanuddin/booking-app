// app/page.tsx
"use client";
import { useEffect, useState } from "react";

type Service = { id: string; name: string; duration_minutes: number };
type Slot = { start: string; end: string };

export default function Page() {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<Slot | null>(null);
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // সার্ভিস লিস্ট লোড
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/services", { cache: "no-store" });
      const data = await res.json();
      setServices(data.services || []);
      if (data.services?.[0]) setServiceId(data.services[0].id);
    })();
  }, []);

  // স্লট লোড
  async function loadSlots() {
    if (!date || !serviceId) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(
        `/api/slots?serviceId=${serviceId}&date=${date}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      setMsg("স্লট লোড করতে সমস্যা হয়েছে!");
    } finally {
      setLoading(false);
    }
  }

  // বুকিং
  async function bookNow() {
    if (!picked) {
      setMsg("একটা সময় নির্বাচন করুন.");
      return;
    }
    if (!name || !email) {
      setMsg("নাম ও ইমেইল দিন.");
      return;
    }

    setSubmitting(true);
    setMsg("বুকিং হচ্ছে...");
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          start: picked.start,
          end: picked.end,
          name,
          email,
        }),
      });
      if (res.ok) setMsg("বুকিং কনফার্ম হয়েছে ✅");
      else if (res.status === 409) setMsg("এই সময়টা আগেই বুকড!");
      else setMsg("বুকিং ফেল হয়েছে, আবার চেষ্টা করুন.");
    } catch {
      setMsg("সার্ভার এরর!");
    } finally {
      setSubmitting(false);
    }
  }

  // নতুন সার্ভিস/ডেট সিলেক্ট করলে স্লট রিসেট
  useEffect(() => {
    setSlots([]);
    setPicked(null);
  }, [serviceId, date]);

  // শুধু ভবিষ্যতের স্লট দেখাও
  const now = new Date();
  const visibleSlots = slots.filter((s) => new Date(s.start) > now);

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "40px auto",
        padding: 16,
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Booking (Supabase)</h1>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          Service:
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration_minutes}m)
              </option>
            ))}
          </select>
        </label>

        <label>
          Date:
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)} // আজকের আগের তারিখ ব্লক
            onChange={(e) => setDate(e.target.value)}
            style={{ marginLeft: 8 }}
          />
        </label>

        <button onClick={loadSlots} disabled={!date || !serviceId || loading}>
          {loading ? "লোড হচ্ছে..." : "ফ্রি স্লট দেখাও"}
        </button>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Available Slots</h2>
        {visibleSlots.length === 0 && (
          <p>আজ/নির্বাচিত তারিখে কোনো ফ্রি স্লট নেই।</p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 8,
          }}
        >
          {visibleSlots.map((s, i) => (
            <button
              key={i}
              onClick={() => setPicked(s)}
              style={{
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: 8,
                background:
                  picked?.start === s.start ? "#e6f7ff" : "white",
              }}
            >
              {new Date(s.start).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" — "}
              {new Date(s.end).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </button>
          ))}
        </div>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <div style={{ display: "grid", gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Your Details</h2>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button onClick={bookNow} disabled={!picked || submitting}>
          {submitting ? "বুকিং হচ্ছে..." : "Confirm Booking"}
        </button>
        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </div>
    </main>
  );
}
