// DEALER INTRO — the banner that opens every round, before the shuffle:
// the round number, the dealer's face and name. In a match's first round it
// also shows the card that won the draw for the deal.

import React, { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { PixelAvatar, PixelCard } from "../PixelCard";
import { reducedMotion } from "../../utils/motion";

const SHOW_MS = 1700;

const DealerIntro = ({ round, dealerName, face, isMe = false, drawnCard = null, onDone }) => {
  const boxRef = useRef(null);

  useLayoutEffect(() => {
    if (!boxRef.current || reducedMotion()) return;
    gsap.fromTo(boxRef.current, { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.3, ease: "back.out(1.8)" });
  }, []);

  // onDone only changes with the round, and the banner remounts each round.
  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), reducedMotion() ? 900 : SHOW_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
      <div
        ref={boxRef}
        className="flex flex-col items-center gap-2 px-5 py-4"
        style={{ backgroundColor: "rgba(10,7,18,0.88)", border: "3px solid #5fd4d6", boxShadow: "0 0 0 3px #0a0712, 0 0 24px rgba(95,212,214,0.35)" }}
      >
        <div className="font-pixel-display text-[10px] tracking-widest text-bone/70">ROUND {round}</div>
        <div className="flex items-center gap-3">
          <PixelAvatar variant={face.variant} customAvatarData={face.customAvatarData} size={51} />
          {drawnCard && <PixelCard rank={drawnCard.rank} suit={drawnCard.suit} width={34} />}
        </div>
        <div className="font-pixel-display text-[13px] text-glow-cyan whitespace-nowrap">
          {isMe ? "YOU DEAL" : `${dealerName.toUpperCase()} DEALS`}
        </div>
        {drawnCard && (
          <div className="font-pixel-body text-[18px] leading-none text-bone/70 whitespace-nowrap">drew the highest card</div>
        )}
      </div>
    </div>
  );
};

export default DealerIntro;
