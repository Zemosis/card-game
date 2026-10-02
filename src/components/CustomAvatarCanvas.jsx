// AVATAR CANVAS — draws any 17x17 avatar (built-in or painted) pixel-exact.
//
// The requested size is snapped so the canvas covers a whole multiple of 17
// DEVICE pixels. With 1 CSS px = 1.25 device px (a Windows laptop at 125%
// scaling), a 51px avatar would otherwise be 63.75 device px — 3.75 per avatar
// pixel — and the browser would draw some pixels 3 wide and some 4. Snapping
// trades a pixel or two of layout size for every avatar pixel being the same
// size. The border sits outside the art so it never crops the edge pixels.

import React, { useEffect, useRef, useState } from "react";
import { renderAvatarToCanvas, snapAvatarSize } from "../utils/avatarConstants";

function useDevicePixelRatio() {
  const [dpr, setDpr] = useState(() => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));
  useEffect(() => {
    // Fires when the page moves to a screen with different scaling, or zooms.
    const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const update = () => setDpr(window.devicePixelRatio || 1);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [dpr]);
  return dpr;
}

export default function CustomAvatarCanvas({ avatarData, size = 51, border = true }) {
  const canvasRef = useRef(null);
  const dpr = useDevicePixelRatio();
  const { device, css } = snapAvatarSize(size, dpr);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !avatarData) return;
    canvas.width = device;
    canvas.height = device;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    renderAvatarToCanvas(ctx, avatarData, device);
  }, [avatarData, device]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: css,
        height: css,
        display: "block",
        flexShrink: 0,
        imageRendering: "pixelated",
        boxShadow: border ? "0 0 0 2px #0a0712, 2px 2px 0 2px #0a0712" : "none",
      }}
    />
  );
}
