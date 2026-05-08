import React, { useRef, useEffect } from "react";
import { renderAvatarToCanvas } from "../utils/avatarConstants";

export default function CustomAvatarCanvas({ avatarData, size = 48 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !avatarData) return;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    renderAvatarToCanvas(ctx, avatarData, size);
  }, [avatarData, size]);

  return (
    <div
      style={{
        width: size,
        height: size,
        fontSize: size,
        border: "0.0625em solid #0a0712",
        boxShadow: "inset 0 0 0 0.021em rgba(255,255,255,0.2), 0.042em 0.042em 0 #0a0712",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: "block" }}
      />
    </div>
  );
}
