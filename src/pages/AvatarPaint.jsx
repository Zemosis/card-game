import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PixelButton, PixelPanel } from "../components/PixelCard";
import CustomAvatarCanvas from "../components/CustomAvatarCanvas";
import ColorPickerModal from "../components/auth/ColorPickerModal";
import { useAuth } from "../hooks/useAuth";
import {
  BASIC_COLORS,
  GRID_SIZE,
  createEmptyGrid,
  serializeAvatar,
} from "../utils/avatarConstants";

const CANVAS_SIZE = 480;
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE;
const MAX_CUSTOM_COLORS = 8;

const AvatarPaint = () => {
  const navigate = useNavigate();
  const { isGuest, identity, updateProfile, loading } = useAuth();
  const canvasRef = useRef(null);

  const [pixels, setPixels] = useState(createEmptyGrid);
  const [initialized, setInitialized] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#f4c430");
  const [tool, setTool] = useState("paint");
  const [isPainting, setIsPainting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [customColors, setCustomColors] = useState([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!loading && !initialized) {
      if (identity.customAvatar?.pixels) {
        setPixels(identity.customAvatar.pixels.map((row) => [...row]));
      }
      setCustomColors(identity.customColors || []);
      setInitialized(true);
    }
  }, [loading, initialized, identity.customAvatar, identity.customColors]);

  useEffect(() => {
    if (!loading && isGuest) navigate("/", { replace: true });
  }, [loading, isGuest, navigate]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const color = pixels[r][c];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        } else {
          const isLight = (r + c) % 2 === 0;
          ctx.fillStyle = isLight ? "#1a1530" : "#14102a";
          ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE + 0.5, 0);
      ctx.lineTo(i * CELL_SIZE + 0.5, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE + 0.5);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE + 0.5);
      ctx.stroke();
    }
  }, [pixels]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  function getCellFromEvent(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scale = CANVAS_SIZE / rect.width;
    const col = Math.floor((x * scale) / CELL_SIZE);
    const row = Math.floor((y * scale) / CELL_SIZE);
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;
    return { row, col };
  }

  function paintCell(row, col) {
    const value = tool === "eraser" ? null : selectedColor;
    if (pixels[row][col] === value) return;
    setPixels((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = value;
      return next;
    });
    setDirty(true);
  }

  function handlePointerDown(e) {
    e.preventDefault();
    const cell = getCellFromEvent(e);
    if (!cell) return;
    setIsPainting(true);
    paintCell(cell.row, cell.col);
  }

  function handlePointerMove(e) {
    if (!isPainting) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    paintCell(cell.row, cell.col);
  }

  function handlePointerUp() {
    setIsPainting(false);
  }

  function handleClear() {
    setPixels(createEmptyGrid());
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({
        custom_avatar: serializeAvatar(pixels),
        avatar: "custom",
      });
      navigate(-1);
    } catch (err) {
      console.error("Failed to save avatar:", err);
      setSaving(false);
    }
  }

  async function handleAddCustomColor(hex) {
    const next = [hex, ...customColors.filter((c) => c !== hex)].slice(0, MAX_CUSTOM_COLORS);
    setCustomColors(next);
    setSelectedColor(hex);
    setTool("paint");
    setShowPicker(false);
    try {
      await updateProfile({ custom_colors: next });
    } catch (err) {
      console.error("Failed to save custom colors:", err);
    }
  }

  function handleLoadAvatar() {
    if (identity.customAvatar?.pixels) {
      setPixels(identity.customAvatar.pixels.map((row) => [...row]));
      setDirty(false);
    }
  }

  function handleNewAvatar() {
    setPixels(createEmptyGrid());
    setDirty(true);
  }

  function selectColor(color) {
    setSelectedColor(color);
    setTool("paint");
  }

  const previewData = { pixels };

  if (loading || isGuest) return null;

  const colorBtnStyle = (color, isSelected) => ({
    width: "100%",
    aspectRatio: "1",
    backgroundColor: color,
    border: isSelected ? "3px solid #f4c430" : "2px solid #1f1a3d",
    boxShadow: isSelected ? "0 0 8px rgba(244,196,48,0.5)" : "none",
    cursor: "pointer",
    transition: "border-color 120ms ease",
  });

  const emptySlotStyle = {
    width: "100%",
    aspectRatio: "1",
    border: "2px dashed #463a78",
    backgroundColor: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 10,
    color: "#f4c430",
    transition: "border-color 120ms ease",
  };

  const customSlots = [];
  for (let i = 0; i < MAX_CUSTOM_COLORS; i++) {
    if (i < customColors.length) {
      const color = customColors[i];
      customSlots.push(
        <button
          key={`custom-${i}`}
          onClick={() => selectColor(color)}
          style={colorBtnStyle(color, tool === "paint" && selectedColor === color)}
        />
      );
    } else {
      customSlots.push(
        <button
          key={`empty-${i}`}
          onClick={() => setShowPicker(true)}
          style={emptySlotStyle}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f4c430")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#463a78")}
        >
          +
        </button>
      );
    }
  }

  return (
    <div className="relative w-full h-screen starfield font-pixel-body text-parchment overflow-hidden flex flex-col">
      {/* TOP BAR */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b-4"
        style={{ borderColor: "#0a0712", background: "#14102a" }}
      >
        <div className="flex items-center gap-4">
          <PixelButton color="dusk" size="sm" onClick={() => navigate(-1)}>
            ◄ BACK
          </PixelButton>
          <div className="flex items-center gap-2 font-pixel-display text-[10px] tracking-wider">
            <span className="text-bone/60">PROFILE ▸</span>
            <span className="text-glow-gold">AVATAR PAINT</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-pixel-body text-base text-bone">
            {identity.name}{" "}
            <span className="text-bone/60">#{identity.tag}</span>
          </span>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex items-start justify-center gap-4 p-4 min-h-0 overflow-auto">
        {/* LEFT — Colors & Tools */}
        <div className="flex flex-col gap-3" style={{ width: 260 }}>
          {/* Basic Colors */}
          <PixelPanel accent="gold" title="✦ BASIC COLORS ✦">
            <div className="p-2">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gap: 3,
                }}
              >
                {BASIC_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => selectColor(color)}
                    style={colorBtnStyle(color, tool === "paint" && selectedColor === color)}
                  />
                ))}
              </div>
            </div>
          </PixelPanel>

          {/* Custom Colors */}
          <PixelPanel accent="cyan" title="⚒ CUSTOM COLORS ⚒">
            <div className="p-2">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gap: 3,
                }}
              >
                {customSlots}
              </div>
            </div>
          </PixelPanel>

          {/* Current Color */}
          <PixelPanel accent="gold" title="✦ CURRENT COLOR ✦">
            <div className="p-2 flex items-center gap-3">
              <div
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  backgroundColor: tool === "eraser" ? "transparent" : selectedColor,
                  border: "3px solid #c89820",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
                  ...(tool === "eraser" ? {
                    backgroundImage: "repeating-conic-gradient(#1a1530 0% 25%, #14102a 0% 50%)",
                    backgroundSize: "12px 12px",
                  } : {}),
                }}
              />
              <div className="font-pixel-display text-[9px] text-bone/70 uppercase">
                {tool === "eraser" ? "ERASER" : selectedColor}
              </div>
            </div>
          </PixelPanel>

          {/* Tools */}
          <PixelPanel accent="dusk" title="⚒ TOOLS ⚒">
            <div className="p-2 flex gap-2 flex-wrap">
              <PixelButton
                color={tool === "paint" ? "gold" : "dusk"}
                size="sm"
                onClick={() => setTool("paint")}
                className="flex-1"
              >
                ✎ PAINT
              </PixelButton>
              <PixelButton
                color={tool === "eraser" ? "gold" : "dusk"}
                size="sm"
                onClick={() => setTool("eraser")}
                className="flex-1"
              >
                ✕ ERASER
              </PixelButton>
              <PixelButton color="dusk" size="sm" onClick={handleClear} className="flex-1">
                ☐ CLEAR
              </PixelButton>
            </div>
          </PixelPanel>
        </div>

        {/* CENTER — Canvas */}
        <div>
          <PixelPanel accent="gold" title="✦ CANVAS ✦">
            <div className="p-2">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                style={{
                  width: CANVAS_SIZE,
                  height: CANVAS_SIZE,
                  cursor: "crosshair",
                  touchAction: "none",
                  display: "block",
                }}
              />
            </div>
          </PixelPanel>
        </div>

        {/* RIGHT — Storage, Preview & Actions */}
        <div className="flex flex-col gap-3" style={{ width: 180 }}>
          {/* Avatar Storage */}
          <PixelPanel accent="cyan" title="⚒ AVATAR STORAGE ⚒">
            <div className="p-2">
              <div className="flex gap-2">
                {/* Slot 1 — saved avatar */}
                {identity.customAvatar ? (
                  <button
                    onClick={handleLoadAvatar}
                    style={{
                      cursor: "pointer",
                      border: "2px solid #2a8a8c",
                      background: "none",
                      padding: 0,
                      transition: "border-color 120ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f4c430")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a8a8c")}
                    title="Load saved avatar"
                  >
                    <CustomAvatarCanvas avatarData={identity.customAvatar} size={48} />
                  </button>
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      border: "2px dashed #463a78",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="font-pixel-display text-[8px] text-bone/30">EMPTY</span>
                  </div>
                )}
                {/* Future slots (locked) */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    border: "2px dashed #1f1a3d",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.4,
                  }}
                  title="Unlock with coins (coming soon)"
                >
                  <span className="font-pixel-display text-[10px] text-bone/30">🔒</span>
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    border: "2px dashed #1f1a3d",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.4,
                  }}
                  title="Unlock with coins (coming soon)"
                >
                  <span className="font-pixel-display text-[10px] text-bone/30">🔒</span>
                </div>
              </div>
              <div className="mt-2">
                <PixelButton color="cyan" size="sm" onClick={handleNewAvatar} className="w-full">
                  + NEW
                </PixelButton>
              </div>
            </div>
          </PixelPanel>

          {/* Preview */}
          <PixelPanel accent="gold" title="✦ PREVIEW ✦">
            <div className="p-3 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="text-center">
                  <CustomAvatarCanvas avatarData={previewData} size={48} />
                  <div className="font-pixel-display text-[7px] text-bone/50 mt-1">48px</div>
                </div>
                <div className="text-center">
                  <CustomAvatarCanvas avatarData={previewData} size={36} />
                  <div className="font-pixel-display text-[7px] text-bone/50 mt-1">36px</div>
                </div>
                <div className="text-center">
                  <CustomAvatarCanvas avatarData={previewData} size={24} />
                  <div className="font-pixel-display text-[7px] text-bone/50 mt-1">24px</div>
                </div>
              </div>
            </div>
          </PixelPanel>

          <div className="flex flex-col gap-2">
            <PixelButton
              color="gold"
              size="md"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="w-full"
            >
              {saving ? "SAVING..." : "✦ SAVE"}
            </PixelButton>
            <PixelButton
              color="dusk"
              size="md"
              onClick={() => navigate(-1)}
              className="w-full"
            >
              ✕ CANCEL
            </PixelButton>
          </div>
        </div>
      </div>

      {showPicker && (
        <ColorPickerModal
          initialColor={selectedColor}
          onSelect={handleAddCustomColor}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
};

export default AvatarPaint;
