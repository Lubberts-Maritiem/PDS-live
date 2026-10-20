"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { VesselState } from "@/lib/nmea";

const LiveMap = dynamic(() => import("./LiveMap"), { ssr: false });

type Latest = {
  state: VesselState;
  raw: string[];
  track?: [number, number, number][];
  serverTime: number;
};

const POLL_MS = 1500;

const FIX: Record<number, string> = {
  0: "Geen fix", 1: "GPS", 2: "DGPS", 4: "RTK fixed", 5: "RTK float", 6: "Dead reckoning",
};

function fmtLat(v?: number, pos = "N", neg = "S") {
  if (v === undefined) return "–";
  const a = Math.abs(v);
  const d = Math.floor(a);
  const m = (a - d) * 60;
  return `${d}° ${m.toFixed(4)}' ${v >= 0 ? pos : neg}`;
}

const f = (v: number | undefined, dec = 1) => (v === undefined ? "–" : v.toFixed(dec));

export default function Dashboard() {
  const [data, setData] = useState<Latest | null>(null);
  const [track, setTrack] = useState<[number, number][]>([]);
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const res = await fetch(`/api/latest${first.current ? "?track=1" : ""}`, { cache: "no-store" });
        const json: Latest & { error?: string } = await res.json();
        if (!res.ok) throw new Error(json.error ?? res.statusText);
        if (stop) return;
        setData(json);
        setError(null);
        if (first.current && json.track) {
          setTrack(json.track.map(([la, lo]) => [la, lo]));
          first.current = false;
        } else if (json.state.lat !== undefined && json.state.lon !== undefined) {
          const p: [number, number] = [json.state.lat, json.state.lon];
          setTrack((t) => {
            const last = t[t.length - 1];
            if (last && last[0] === p[0] && last[1] === p[1]) return t;
            return [...t.slice(-999), p];
          });
        }
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "Verbindingsfout");
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { stop = true; clearInterval(id); };
  }, []);

  const s = data?.state ?? {};
  const age = s.updatedAt && data ? (data.serverTime - s.updatedAt) / 1000 : Infinity;
  const live = age < 10;
  const statusClass = error ? "" : live ? "ok" : age < 120 ? "stale" : "";
  const statusText = error
    ? `Fout: ${error}`
    : !s.updatedAt
    ? "Nog geen data ontvangen"
    : live
    ? "Live"
    : `Laatste data ${Math.round(age)} s geleden`;

  return (
    <div className="wrap">
      <aside className="side">
        <h1>Live vaartuigdata</h1>
        <div className="status"><span className={`dot ${statusClass}`} />{statusText}</div>

        <div className="grid">
          <div className="tile wide">
            <div className="label">Positie (WGS84)</div>
            <div className="value small">{fmtLat(s.lat)}<br />{fmtLat(s.lon, "E", "W")}</div>
          </div>
          <div className="tile">
            <div className="label">Heading</div>
            <div className="value">{f(s.heading)}<span className="unit">°</span></div>
          </div>
          <div className="tile">
            <div className="label">Diepte</div>
            <div className="value">{f(s.depth, 2)}<span className="unit">m</span></div>
          </div>
          <div className="tile">
            <div className="label">Snelheid</div>
            <div className="value">{f(s.sogKnots)}<span className="unit">kn</span></div>
          </div>
          <div className="tile">
            <div className="label">COG</div>
            <div className="value">{f(s.cog)}<span className="unit">°</span></div>
          </div>
          <div className="tile">
            <div className="label">Fix</div>
            <div className="value small">{s.fixQuality !== undefined ? FIX[s.fixQuality] ?? s.fixQuality : "–"}</div>
          </div>
          <div className="tile">
            <div className="label">Sats / HDOP</div>
            <div className="value small">{f(s.satellites, 0)} / {f(s.hdop)}</div>
          </div>
          <div className="tile wide">
            <div className="label">GPS-tijd (UTC)</div>
            <div className="value small">{s.gpsTime ?? "–"}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn ${follow ? "on" : ""}`} onClick={() => setFollow(!follow)}>
            {follow ? "Volgen: aan" : "Volgen: uit"}
          </button>
          <button className="btn" onClick={() => setTrack([])}>Spoor wissen (scherm)</button>
        </div>

        <div>
          <div className="label" style={{ marginBottom: 6 }}>Laatste ruwe regels</div>
          <div className="raw">{(data?.raw ?? []).join("\n") || "–"}</div>
        </div>
      </aside>

      <main className="map">
        <LiveMap lat={s.lat} lon={s.lon} heading={s.heading ?? s.cog} track={track} follow={follow} />
      </main>
    </div>
  );
}
