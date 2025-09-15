"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ReschedulePage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [newDate, setNewDate] = useState("");
  const [msg, setMsg] = useState("");

  async function handleReschedule() {
    if (!token || !newDate) {
      setMsg("Missing info ❌");
      return;
    }
    try {
      const res = await fetch("/api/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newStart: newDate }),
      });
      if (res.ok) {
        setMsg("✅ বুকিং রিশিডিউল হয়েছে");
      } else {
        const txt = await res.text();
        setMsg("❌ ফেল হয়েছে: " + txt);
      }
    } catch {
      setMsg("Server error ❌");
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Reschedule Booking</h1>
      <p>নতুন সময় নির্বাচন করুন:</p>
      <input
        type="datetime-local"
        value={newDate}
        onChange={(e) => setNewDate(e.target.value)}
        style={{ padding: 6, marginTop: 8 }}
      />
      <button
        onClick={handleReschedule}
        style={{
          marginLeft: 8,
          padding: "6px 12px",
          background: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: 4,
        }}
      >
        Confirm
      </button>
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
