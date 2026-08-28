import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API } from "../lib/api";

/**
 * DeliveryZoneMap — Interactive Google Maps component showing restaurant location
 * and delivery radius circle. Fetches live delivery settings from backend so the
 * radius always matches what the admin configured. Helps customers see if they're
 * in the delivery area and improves local SEO by visualizing service coverage.
 *
 * Props:
 * - height: string — Map container height (default: "400px")
 */
export default function DeliveryZoneMap({ height = "400px" }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch delivery settings from backend
    useEffect(() => {
        axios
            .get(`${API}/public/business-hours`)
            .then(({ data }) => {
                setSettings(data);
                setLoading(false);
            })
            .catch(() => {
                // Fallback to defaults if API fails
                setSettings({
                    restaurant_lat: 31.476160223132307,
                    restaurant_lng: 74.4162998720065,
                    delivery_max_radius_km: 15,
                });
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (!mapRef.current || !window.google || !settings) return;

        const center = {
            lat: settings.restaurant_lat,
            lng: settings.restaurant_lng,
        };
        const radiusKm = settings.delivery_max_radius_km;

        // Initialize map
        const map = new window.google.maps.Map(mapRef.current, {
            center,
            zoom: 11,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }],
                },
            ],
        });

        mapInstanceRef.current = map;

        // Add custom marker for restaurant
        const marker = new window.google.maps.Marker({
            position: center,
            map,
            title: "Karachi Naseeb Biryani & Murg Pulao",
            icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: "#D92D20",
                fillOpacity: 1,
                strokeColor: "#FFFFFF",
                strokeWeight: 3,
            },
        });

        // Info window for restaurant
        const infoWindow = new window.google.maps.InfoWindow({
            content: `
                <div style="padding: 8px; font-family: 'Outfit', sans-serif;">
                    <h3 style="margin: 0 0 4px; font-weight: 700; color: #1a1a1a; font-size: 16px;">Karachi Naseeb Biryani</h3>
                    <p style="margin: 0; color: #666; font-size: 13px;">68 Chatri Chowk, D Block, Lahore</p>
                    <p style="margin: 4px 0 0; color: #D92D20; font-size: 13px; font-weight: 600;">📍 We deliver within ${radiusKm}km</p>
                </div>
            `,
        });

        marker.addListener("click", () => {
            infoWindow.open(map, marker);
        });

        // Draw delivery zone circle
        const circle = new window.google.maps.Circle({
            map,
            center,
            radius: radiusKm * 1000, // Convert km to meters
            fillColor: "#D92D20",
            fillOpacity: 0.15,
            strokeColor: "#D92D20",
            strokeOpacity: 0.5,
            strokeWeight: 2,
        });

        // Fit bounds to show entire delivery zone
        const bounds = circle.getBounds();
        if (bounds) {
            map.fitBounds(bounds);
        }

        // Cleanup
        return () => {
            if (marker) marker.setMap(null);
            if (circle) circle.setMap(null);
            if (mapInstanceRef.current) mapInstanceRef.current = null;
        };
    }, [settings]);

    if (loading) {
        return (
            <div
                style={{
                    width: "100%",
                    height,
                    borderRadius: "16px",
                    backgroundColor: "#f5f5f5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <p style={{ color: "#666", fontSize: "14px" }}>Loading map...</p>
            </div>
        );
    }

    return (
        <div
            ref={mapRef}
            style={{ width: "100%", height, borderRadius: "16px" }}
            data-testid="delivery-zone-map"
        />
    );
}
