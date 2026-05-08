import React, { useState, useRef, useEffect, useCallback } from "react";
import { PixelButton } from "../PixelCard";
import { hsbToHex, hexToHsb } from "../../utils/avatarConstants";

const SB_SIZE = 220;
const HUE_WIDTH = 24;
const HUE_HEIGHT = SB_SIZE;

export default function ColorPickerModal({ initialColor, onSelect, onClose }) {
  const initial = hexToHsb(initialColor || "#ff0000");
  const [hue, setHue] = useState(initial.h);
  const [sat, setSat] = useState(initial.s);
  const [bri, setBri] = useState(initial.b);
  const [hexInput, setHexInput] = useState(initialColor || "#ff0000");

  const sbRef = useRef(null);
  const hueRef = useRef(null);
  const dragging = useRef(null);

  const currentHex = hsbToHex(hue, sat, bri);

  useEffect(() => {
    setHexInput(currentHex);
  }, [currentHex]);

  const drawSB = useCallback(() => {
    const canvas = sbRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = SB_SIZE;
    canvas.height = SB_SIZE;

    const pureColor = hsbToHex(hue, 100, 100);
    ctx.fillStyle = pureColor;
    ctx.fillRect(0, 0, SB_SIZE, SB_SIZE);

    const whiteGrad = ctx.createLinearGradient(0, 0, SB_SIZE, 0);
    whiteGrad.addColorStop(0, "rgba(255,255,255,1)");
    whiteGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, SB_SIZE, SB_SIZE);

    const blackGrad = ctx.createLinearGradient(0, 0, 0, SB_SIZE);
    blackGrad.addColorStop(0, "rgba(0,0,0,0)");
    blackGrad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, SB_SIZE, SB_SIZE);
  }, [hue]);

  const drawHue = useCallback(() => {
    const canvas = hueRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = HUE_WIDTH;
    canvas.height = HUE_HEIGHT;
    const grad = ctx.createLinearGradient(0, 0, 0, HUE_HEIGHT);
    for (let i = 0; i <= 6; i++) {
      grad.addColorStop(i / 6, `hsl(${i * 60}, 100%, 50%)`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, HUE_WIDTH, HUE_HEIGHT);
  }, []);

  useEffect(() => { drawSB(); }, [drawSB]);
  useEffect(() => { drawHue(); }, [drawHue]);

  function handleSBPointer(e) {
    const rect = sbRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(SB_SIZE, (e.clientX - rect.left) * (SB_SIZE / rect.width)));
    const y = Math.max(0, Math.min(SB_SIZE, (e.clientY - rect.top) * (SB_SIZE / rect.height)));
    setSat((x / SB_SIZE) * 100);
    setBri(100 - (y / SB_SIZE) * 100);
  }

  function handleHuePointer(e) {
    const rect = hueRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(HUE_HEIGHT, (e.clientY - rect.top) * (HUE_HEIGHT / rect.height)));
    setHue((y / HUE_HEIGHT) * 360);
  }

  useEffect(() => {
    function handleMove(e) {
      if (dragging.current === "sb") handleSBPointer(e);
      else if (dragging.current === "hue") handleHuePointer(e);
    }
    function handleUp() { dragging.current = null; }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  function handleHexChange(val) {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      const hsb = hexToHsb(val);
      setHue(hsb.h);
      setSat(hsb.s);
      setBri(hsb.b);
    }
  }

  const sbX = (sat / 100) * SB_SIZE;
  const sbY = ((100 - bri) / 100) * SB_SIZE;
  const hueY = (hue / 360) * HUE_HEIGHT;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(10, 7, 18, 0.88)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: 460,
          backgroundColor: "#14102a",
          border: "4px solid #c89820",
          boxShadow: "0 0 0 4px #0a0712, 0 0 40px rgba(244,196,48,0.2), inset 0 4px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: "#f4c430", borderBottom: "4px solid #0a0712" }}
        >
          <span className="font-pixel-display text-[10px]" style={{ color: "#1a1024" }}>
            ✦ EDIT COLORS ✦
          </span>
          <button
            onClick={onClose}
            className="font-pixel-display text-[10px] px-2 py-1"
            style={{
              backgroundColor: "#1a1024",
              color: "#f4c430",
              border: "2px solid #0a0712",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Picker area */}
          <div className="flex gap-4">
            {/* SB square */}
            <div style={{ position: "relative", cursor: "crosshair" }}>
              <canvas
                ref={sbRef}
                style={{ width: SB_SIZE, height: SB_SIZE, display: "block", border: "2px solid #0a0712" }}
                onPointerDown={(e) => { dragging.current = "sb"; handleSBPointer(e); }}
              />
              <div
                style={{
                  position: "absolute",
                  left: sbX - 7,
                  top: sbY - 7,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: "2px solid #fff",
                  boxShadow: "0 0 0 1px #000",
                  pointerEvents: "none",
                }}
              />
            </div>

            {/* Hue strip */}
            <div style={{ position: "relative", cursor: "pointer" }}>
              <canvas
                ref={hueRef}
                style={{ width: HUE_WIDTH, height: HUE_HEIGHT, display: "block", border: "2px solid #0a0712" }}
                onPointerDown={(e) => { dragging.current = "hue"; handleHuePointer(e); }}
              />
              <div
                style={{
                  position: "absolute",
                  left: -2,
                  top: hueY - 3,
                  width: HUE_WIDTH + 4,
                  height: 6,
                  border: "2px solid #fff",
                  boxShadow: "0 0 0 1px #000",
                  pointerEvents: "none",
                }}
              />
            </div>

            {/* Info panel */}
            <div className="flex flex-col gap-3 flex-1" style={{ minWidth: 140 }}>
              {/* Preview swatch */}
              <div
                style={{
                  width: "100%",
                  height: 48,
                  backgroundColor: currentHex,
                  border: "3px solid #0a0712",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
                }}
              />

              {/* Hex input */}
              <div>
                <label className="font-pixel-display text-[8px] text-bone/60 block mb-1">
                  HEX
                </label>
                <input
                  value={hexInput}
                  onChange={(e) => handleHexChange(e.target.value)}
                  maxLength={7}
                  className="w-full font-pixel-display text-parchment uppercase"
                  style={{
                    fontSize: 14,
                    backgroundColor: "#0a0712",
                    border: "3px solid #1f1a3d",
                    boxShadow: "inset 0 2px 0 0 rgba(0,0,0,0.5)",
                    padding: "6px 8px",
                    letterSpacing: "0.02em",
                  }}
                />
              </div>

              {/* HSB readout */}
              <div className="flex flex-col gap-1.5">
                {[
                  { label: "H", value: `${Math.round(hue)}°` },
                  { label: "S", value: `${Math.round(sat)}%` },
                  { label: "B", value: `${Math.round(bri)}%` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between font-pixel-display text-[11px]"
                    style={{
                      backgroundColor: "#0a0712",
                      border: "2px solid #1f1a3d",
                      padding: "4px 8px",
                    }}
                  >
                    <span style={{ color: "#c89820" }}>{label}</span>
                    <span className="text-parchment">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <PixelButton
              color="gold"
              size="md"
              onClick={() => onSelect(currentHex)}
              className="flex-1"
            >
              ✦ SELECT COLOR
            </PixelButton>
            <PixelButton
              color="dusk"
              size="md"
              onClick={onClose}
              className="flex-1"
            >
              CANCEL
            </PixelButton>
          </div>
        </div>
      </div>
    </div>
  );
}
