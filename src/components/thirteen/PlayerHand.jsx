// PLAYER HAND - Pixel Retro Fanned Hand

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { PixelCard } from "../PixelCard";
import { sortHand } from "../../utils/deckUtils";
import { identifyCombination } from "../../utils/handEvaluator";
import { COMBO_NAMES } from "../../utils/constants";
import gsap from "gsap";

const SORT_DURATION = 0.6;
const HAND_HEIGHT = 156;

// Fan geometry: cards sit on an arc as if held — edges tilt outward and dip
// slightly lower than the center.
const getCardPosition = (index, total) => {
  const mid = (total - 1) / 2;
  const d = index - mid;
  const spacing = total > 1 ? Math.min(46, 640 / (total - 1)) : 0;
  const rotation = d * Math.min(2.4, 30 / Math.max(total - 1, 1));
  const y = Math.pow(Math.abs(d) * 2.1, 2) * 0.09; // arc dip at the edges
  return { offset: d * spacing, rotation, y };
};

const PlayerHand = ({
  hand = [],
  selectedCards = [],
  onSelectionChange,
  isActive = true,
  showCardCount = true,
  isDealing = false,
  onSortComplete,
}) => {
  const [displayHand, setDisplayHand] = useState([]);
  const [isSorting, setIsSorting] = useState(false);
  const lastSelectedIndex = useRef(-1);
  const cardRefsMap = useRef(new Map());
  const containerRef = useRef(null);
  const prevIsDealingRef = useRef(isDealing);
  const dealingHandRef = useRef([]);
  const sortDataRef = useRef(null);
  const timelineRef = useRef(null);
  const knownIdsRef = useRef(new Set());

  useEffect(() => {
    const wasDealing = prevIsDealingRef.current;
    prevIsDealingRef.current = isDealing;

    if (isDealing) {
      setDisplayHand(hand);
      dealingHandRef.current = hand;
      return;
    }

    // Transition from dealing -> not dealing: run sort animation
    if (wasDealing && hand.length > 0) {
      const preSortHand =
        dealingHandRef.current.length > 0 ? dealingHandRef.current : hand;
      dealingHandRef.current = [];
      const sorted = sortHand(hand);

      if (preSortHand.length === 0) {
        setDisplayHand(sorted);
        return;
      }

      const oldPositions = {};
      preSortHand.forEach((card, i) => {
        oldPositions[card.id] = getCardPosition(i, preSortHand.length);
      });

      const newPositions = {};
      sorted.forEach((card, i) => {
        newPositions[card.id] = getCardPosition(i, sorted.length);
      });

      sortDataRef.current = { oldPositions, newPositions, sorted };
      setDisplayHand(sorted);
      setIsSorting(true);
      return;
    }

    dealingHandRef.current = [];
    setDisplayHand(sortHand(hand));
  }, [isDealing, hand]);

  // Fly newly dealt cards in from the table center so the deal feels connected
  useLayoutEffect(() => {
    if (!isDealing) {
      knownIdsRef.current = new Set(displayHand.map((c) => c.id));
      return;
    }
    const fresh = displayHand.filter((c) => !knownIdsRef.current.has(c.id));
    displayHand.forEach((c) => knownIdsRef.current.add(c.id));
    fresh.forEach((card) => {
      const el = cardRefsMap.current.get(card.id);
      if (!el) return;
      gsap.fromTo(
        el,
        {
          y: -150,
          x: gsap.utils.random(-30, 30),
          rotation: gsap.utils.random(-20, 20),
          scale: 0.7,
          opacity: 0,
        },
        {
          y: 0,
          x: 0,
          rotation: 0,
          scale: 1,
          opacity: 1,
          duration: 0.32,
          ease: "power2.out",
          overwrite: true,
        },
      );
    });
  }, [displayHand, isDealing]);

  useLayoutEffect(() => {
    if (!isSorting) return;

    const data = sortDataRef.current;
    if (!data) {
      setIsSorting(false);
      return;
    }

    const { oldPositions, newPositions, sorted } = data;

    if (timelineRef.current) timelineRef.current.kill();

    const tl = gsap.timeline({
      onComplete: () => {
        sorted.forEach((card) => {
          const el = cardRefsMap.current.get(card.id);
          if (el) gsap.set(el, { clearProps: "all" });
        });
        timelineRef.current = null;
        sortDataRef.current = null;
        setIsSorting(false);
        if (onSortComplete) onSortComplete();
      },
    });
    timelineRef.current = tl;

    let hasTweens = false;
    sorted.forEach((card) => {
      const el = cardRefsMap.current.get(card.id);
      if (!el) return;

      const oldPos = oldPositions[card.id];
      const newPos = newPositions[card.id];
      if (!oldPos || !newPos) return;

      const deltaX = oldPos.offset - newPos.offset;
      const deltaY = oldPos.y - newPos.y;
      const deltaR = oldPos.rotation - newPos.rotation;

      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaR) < 0.1) return;

      gsap.set(el, { x: deltaX, y: deltaY, rotation: deltaR });
      tl.to(
        el,
        {
          x: 0,
          y: 0,
          rotation: 0,
          duration: SORT_DURATION,
          ease: "power2.inOut",
        },
        0,
      );
      hasTweens = true;
    });

    if (!hasTweens) {
      timelineRef.current = null;
      sortDataRef.current = null;
      setIsSorting(false);
    }

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
    };
  }, [isSorting, onSortComplete]);

  // Safety: guarantee isSorting always resets so cards stay clickable
  useEffect(() => {
    if (!isSorting) return;
    const timeout = setTimeout(() => {
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
      sortDataRef.current = null;
      setIsSorting(false);
    }, SORT_DURATION * 1000 + 1000);
    return () => clearTimeout(timeout);
  }, [isSorting]);

  useEffect(() => {
    return () => {
      if (timelineRef.current) timelineRef.current.kill();
    };
  }, []);

  const toggleCardSelection = (card, e) => {
    if (!isActive || isSorting) return;

    const currentIndex = displayHand.findIndex((c) => c.id === card.id);

    if (e && e.shiftKey && lastSelectedIndex.current !== -1) {
      const start = Math.min(lastSelectedIndex.current, currentIndex);
      const end = Math.max(lastSelectedIndex.current, currentIndex);
      const rangeCards = displayHand.slice(start, end + 1);
      const newSelectionMap = new Map();
      selectedCards.forEach((c) => newSelectionMap.set(c.id, c));
      rangeCards.forEach((c) => newSelectionMap.set(c.id, c));
      onSelectionChange(Array.from(newSelectionMap.values()));
    } else {
      lastSelectedIndex.current = currentIndex;
      const isSelected = selectedCards.some((c) => c.id === card.id);
      if (isSelected) {
        onSelectionChange(selectedCards.filter((c) => c.id !== card.id));
      } else {
        onSelectionChange([...selectedCards, card]);
      }
    }
  };

  const handleSelectAll = () => {
    if (!isActive || isSorting) return;
    onSelectionChange([...displayHand]);
    lastSelectedIndex.current = -1;
  };

  const handleClearSelection = () => {
    if (!isActive || isSorting) return;
    onSelectionChange([]);
    lastSelectedIndex.current = -1;
  };

  const isCardSelected = (card) => selectedCards.some((c) => c.id === card.id);

  const getCombinationInfo = () => {
    if (selectedCards.length === 0) return null;
    const combo = identifyCombination(selectedCards);
    if (!combo) return { text: "Invalid", isValid: false };
    return { text: COMBO_NAMES[combo.type] || "Valid", isValid: true };
  };

  const comboInfo = getCombinationInfo();

  const setCardRef = useCallback((id, el) => {
    if (el) cardRefsMap.current.set(id, el);
    else cardRefsMap.current.delete(id);
  }, []);

  return (
    <div className="relative">
      {/* Status bar above hand */}
      <div className="flex items-center justify-between mb-1 px-2">
        <div className="flex items-center gap-3">
          <div
            className="font-pixel-display text-[10px] text-glow-gold"
            style={{ opacity: isActive ? 1 : 0.5 }}
          >
            {isActive ? "YOUR TURN" : "WAITING"}
          </div>
          {isSorting && (
            <div
              className="font-pixel-display text-[9px] shimmer-text"
              style={{ letterSpacing: "0.15em" }}
            >
              SORTING...
            </div>
          )}
          <div className="font-pixel-body text-base text-bone/70">
            {showCardCount && <>{displayHand.length} cards</>}
            {selectedCards.length > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="text-glow-cyan">
                  {selectedCards.length} selected
                </span>
                {comboInfo && (
                  <span
                    className="ml-2"
                    style={{
                      color: comboInfo.isValid ? "#f4c430" : "#e85a7a",
                    }}
                  >
                    → {comboInfo.text}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div
          className="flex items-center gap-2"
          style={{
            visibility: hand.length > 0 ? "visible" : "hidden",
            opacity: isActive ? 1 : 0.5,
          }}
        >
          <button
            onClick={handleClearSelection}
            disabled={selectedCards.length === 0 || !isActive}
            className="pixel-btn font-pixel-display text-[9px] px-2.5 py-1.5"
            style={{
              backgroundColor: "#1f1a3d",
              borderColor: "#0a0712",
              color: "#ead8b1",
            }}
          >
            CLEAR
          </button>
          <button
            onClick={handleSelectAll}
            disabled={!isActive}
            className="pixel-btn font-pixel-display text-[9px] px-2.5 py-1.5"
            style={{
              backgroundColor: "#463a78",
              borderColor: "#2a234d",
              color: "#ead8b1",
            }}
          >
            ALL
          </button>
        </div>
      </div>

      {/* Hand fan */}
      {hand.length === 0 && !isDealing ? (
        <div
          className="flex items-center justify-center"
          style={{ height: HAND_HEIGHT }}
        >
          <div className="font-pixel-display text-[11px] text-glow-gold">
            NO CARDS — YOU WIN!
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative"
          style={{ height: HAND_HEIGHT, overflow: "visible" }}
        >
          {displayHand.map((card, i) => {
            const isSel = isCardSelected(card);
            const { offset, rotation, y } = getCardPosition(
              i,
              displayHand.length,
            );
            return (
              <div
                key={card.id}
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 14,
                  transform: `translateX(calc(-50% + ${offset}px)) translateY(${y}px) rotate(${rotation}deg)`,
                  transformOrigin: "bottom center",
                  zIndex: i,
                }}
              >
                <div ref={(el) => setCardRef(card.id, el)}>
                  <PixelCard
                    rank={card.rank}
                    suit={card.suit}
                    size="medium"
                    selected={isSel}
                    selectable={isActive && !isSorting}
                    onClick={() => toggleCardSelection(card)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlayerHand;
