import React from "react";
import { X } from "lucide-react";

const PRESET_COLORS = [
  "#1E3F20", // dark green
  "#2E7D32", // green
  "#C62828", // red
  "#EF6C00", // orange
  "#F9A825", // amber
  "#FBC02D", // yellow
  "#1565C0", // blue
  "#00838F", // teal
  "#6A1B9A", // purple
  "#AD1457", // pink
  "#4E342E", // brown
  "#37474F", // slate
];

export default function ColorPicker({ value, onChange, label = "Button Color" }) {
  const isPreset = PRESET_COLORS.includes(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "#1A1D1A" }}>{label}</span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            data-testid="color-picker-clear"
            className="text-xs flex items-center gap-1 hover:underline"
            style={{ color: "#5C5F5C" }}
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            data-testid={`color-swatch-${color.replace("#", "")}`}
            onClick={() => onChange(color)}
            className="w-9 h-9 rounded-md border-2 transition-transform hover:scale-110"
            style={{
              background: color,
              borderColor: value === color ? "#1A1D1A" : "transparent",
              boxShadow: value === color ? "0 0 0 2px white inset" : "none",
            }}
            aria-label={color}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="color"
          data-testid="color-picker-custom"
          value={value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#1E3F20"}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-md border border-[#E5E2DC] cursor-pointer"
        />
        <input
          type="text"
          data-testid="color-picker-hex"
          placeholder="#RRGGBB"
          value={value || ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v || null);
          }}
          className="flex-1 h-9 px-3 text-sm border border-[#E5E2DC] rounded-md font-mono"
        />
        {value && (
          <div
            className="w-9 h-9 rounded-md border border-[#E5E2DC]"
            style={{ background: value }}
            title="Preview"
          />
        )}
      </div>

      <p className="text-xs" style={{ color: "#5C5F5C" }}>
        {isPreset ? "Preset color selected" : value ? "Custom color" : "No color (default)"}
      </p>
    </div>
  );
}
