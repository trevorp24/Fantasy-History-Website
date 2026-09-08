"use client";

import { useEffect, useMemo, useState } from "react";

const TRADE_DEADLINE = new Date("2026-12-02T12:00:00-05:00");

function getParts(now: Date) {
  const remaining = Math.max(0, TRADE_DEADLINE.getTime() - now.getTime());
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isLive: remaining === 0
  };
}

export function DraftCountdown() {
  const [now, setNow] = useState(() => new Date());
  const parts = useMemo(() => getParts(now), [now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="countdown-card">
      <span className="eyebrow">Trade deadline</span>
      <strong>{parts.isLive ? "Trade deadline passed" : "December 2, 2026 - 12:00 PM EST"}</strong>
      <div className="countdown-grid" aria-label="Countdown to the trade deadline">
        <span><b>{parts.days}</b><small>Days</small></span>
        <span><b>{parts.hours}</b><small>Hours</small></span>
        <span><b>{parts.minutes}</b><small>Minutes</small></span>
        <span><b>{parts.seconds}</b><small>Seconds</small></span>
      </div>
    </div>
  );
}
