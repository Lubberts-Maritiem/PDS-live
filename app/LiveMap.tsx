"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

type Props = {
  lat?: number;
  lon?: number;
  heading?: number;
  track: [number, number][];
  follow: boolean;
};

// Scheepssymbool dat meedraait met de heading
function vesselIcon(heading = 0) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<svg width="28" height="28" viewBox="0 0 28 28" style="transform:rotate(${heading}deg)">
      <path d="M14 2 L22 24 L14 19 L6 24 Z" fill="#35c2c1" stroke="#0b1620" stroke-width="1.5"/>
    </svg>`,
  });
}

export default function LiveMap({ lat, lon, heading, track, follow }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const line = useRef<L.Polyline | null>(null);
  const centered = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView([52.0, 4.3], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    // Zeekaart-overlay (boeien, vaarwegen)
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenSeaMap",
    }).addTo(m);
    line.current = L.polyline([], { color: "#35c2c1", weight: 2, opacity: 0.8 }).addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    line.current?.setLatLngs(track);
  }, [track]);

  useEffect(() => {
    const m = map.current;
    if (!m || lat === undefined || lon === undefined) return;
    if (!marker.current) {
      marker.current = L.marker([lat, lon], { icon: vesselIcon(heading) }).addTo(m);
    } else {
      marker.current.setLatLng([lat, lon]);
      marker.current.setIcon(vesselIcon(heading));
    }
    if (!centered.current) {
      m.setView([lat, lon], 15);
      centered.current = true;
    } else if (follow) {
      m.panTo([lat, lon], { animate: true });
    }
  }, [lat, lon, heading, follow]);

  return <div ref={el} />;
}
