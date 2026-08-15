import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// CRA/webpack can't resolve Leaflet's relative marker image paths, so point the
// default icon at the CDN copies explicitly.
const markerIcon = new L.Icon({
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

/**
 * LocationPicker — a small OpenStreetMap (Leaflet) map with a single draggable
 * marker. Lets the customer confirm / fine-tune the EXACT delivery point so the
 * distance and fee are accurate. No API key required.
 *
 * Props:
 *   lat, lng   — current coordinates (numbers). Falls back to the restaurant.
 *   onChange   — (lat, lng) => void, fired when the pin is dragged or the map tapped.
 *   height     — map height in px (default 220).
 */
export default function LocationPicker({ lat, lng, onChange, height = 220 }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Initialise the map exactly once.
    useEffect(() => {
        if (mapRef.current || !containerRef.current) return;
        const startLat = Number.isFinite(lat) ? lat : 31.4761875;
        const startLng = Number.isFinite(lng) ? lng : 74.4163125;

        const map = L.map(containerRef.current, {
            center: [startLat, startLng],
            zoom: 16,
            scrollWheelZoom: false,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        const marker = L.marker([startLat, startLng], { draggable: true, icon: markerIcon }).addTo(map);
        const emit = (p) => onChangeRef.current && onChangeRef.current(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
        marker.on("dragend", () => emit(marker.getLatLng()));
        map.on("click", (e) => { marker.setLatLng(e.latlng); emit(e.latlng); });

        mapRef.current = map;
        markerRef.current = marker;
        // The map often mounts inside a flex/animated container whose size isn't
        // final on first paint; recalc so tiles fill the box.
        setTimeout(() => map.invalidateSize(), 200);

        return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the marker/view in sync when the parent changes coords (e.g. after
    // "Use My Location" recentres on the GPS fix).
    useEffect(() => {
        if (!mapRef.current || !markerRef.current) return;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const cur = markerRef.current.getLatLng();
        if (Math.abs(cur.lat - lat) > 1e-6 || Math.abs(cur.lng - lng) > 1e-6) {
            markerRef.current.setLatLng([lat, lng]);
            mapRef.current.setView([lat, lng], mapRef.current.getZoom());
        }
    }, [lat, lng]);

    return (
        <div
            ref={containerRef}
            data-testid="location-picker-map"
            style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", zIndex: 0 }}
        />
    );
}