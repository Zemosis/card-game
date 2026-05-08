import React, { useState, useRef, useEffect } from "react";
import { PixelAvatar } from "../PixelCard";

const VARIANTS = [1, 2, 3, 4, 5];

export default function AvatarPickerDropdown({
  currentVariant,
  size = 32,
  disabled,
  onSelect,
  customAvatarData = null,
  onNavigatePaint,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const btnStyle = (selected) => ({
    padding: 3,
    border: selected ? "3px solid #f4c430" : "3px solid #1f1a3d",
    backgroundColor: selected ? "#2a1f1a" : "#0a0712",
    boxShadow: selected ? "0 0 10px rgba(244,196,48,0.5)" : "none",
    cursor: "pointer",
    transition: "border-color 120ms ease, box-shadow 120ms ease",
  });

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          padding: 0,
          border: "none",
          background: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "block",
        }}
      >
        <PixelAvatar
          variant={currentVariant}
          size={size}
          customAvatarData={currentVariant === "custom" ? customAvatarData : null}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            zIndex: 100,
            backgroundColor: "#14102a",
            border: "3px solid #c89820",
            boxShadow: "0 0 0 3px #0a0712, 0 4px 12px rgba(0,0,0,0.5)",
            padding: 8,
          }}
        >
          {/* Caret */}
          <div
            style={{
              position: "absolute",
              top: -8,
              right: 10,
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderBottom: "8px solid #c89820",
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            {VARIANTS.map((v) => (
              <button
                key={v}
                onClick={() => {
                  onSelect(v);
                  setOpen(false);
                }}
                style={btnStyle(currentVariant === v)}
              >
                <PixelAvatar variant={v} size={36} />
              </button>
            ))}

            {customAvatarData && (
              <button
                onClick={() => {
                  onSelect("custom");
                  setOpen(false);
                }}
                style={btnStyle(currentVariant === "custom")}
              >
                <PixelAvatar variant="custom" size={36} customAvatarData={customAvatarData} />
              </button>
            )}

            {!disabled && onNavigatePaint && (
              <button
                onClick={() => {
                  setOpen(false);
                  onNavigatePaint();
                }}
                style={{
                  padding: 3,
                  border: "3px solid #1f1a3d",
                  backgroundColor: "#0a0712",
                  cursor: "pointer",
                  width: 42,
                  height: 42,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 16,
                  color: "#f4c430",
                  transition: "border-color 120ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f4c430")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1f1a3d")}
              >
                +
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
