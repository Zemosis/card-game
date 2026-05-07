import React from "react";
import { PixelAvatar } from "../PixelCard";

const VARIANTS = [1, 2, 3, 4, 5];

export default function AvatarPicker({ selected, onSelect, disabled }) {
  return (
    <div className="flex gap-2 justify-center">
      {VARIANTS.map((v) => (
        <button
          key={v}
          onClick={() => !disabled && onSelect(v)}
          disabled={disabled}
          style={{
            padding: 3,
            border:
              selected === v
                ? "3px solid #f4c430"
                : "3px solid #1f1a3d",
            backgroundColor: selected === v ? "#2a1f1a" : "#0a0712",
            boxShadow:
              selected === v
                ? "0 0 10px rgba(244,196,48,0.5)"
                : "none",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.4 : 1,
            transition: "border-color 120ms ease, box-shadow 120ms ease",
          }}
        >
          <PixelAvatar variant={v} size={40} />
        </button>
      ))}
    </div>
  );
}
