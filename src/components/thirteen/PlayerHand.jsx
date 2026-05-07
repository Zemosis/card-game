// PLAYER HAND - Pixel Retro Fanned Hand

import React, { useState, useEffect, useRef } from "react";
import { PixelCard, PixelAvatar, HeartIcons } from "../PixelCard";
import { sortHand } from "../../utils/deckUtils";
import { identifyCombination } from "../../utils/handEvaluator";
import { COMBO_NAMES } from "../../utils/constants";

const PlayerHand = ({
  hand = [],
  selectedCards = [],
  onSelectionChange,
  isActive = true,
  showCardCount = true,
}) => {
  const [sortedHand, setSortedHand] = useState([]);
  const lastSelectedIndex = useRef(-1);

  useEffect(() => {
    setSortedHand(sortHand(hand));
    lastSelectedIndex.current = -1;
  }, [hand]);

  const toggleCardSelection = (card, e) => {
    if (!isActive) return;

    const currentIndex = sortedHand.findIndex((c) => c.id === card.id);

    if (e && e.shiftKey && lastSelectedIndex.current !== -1) {
      const start = Math.min(lastSelectedIndex.current, currentIndex);
      const end = Math.max(lastSelectedIndex.current, currentIndex);
      const rangeCards = sortedHand.slice(start, end + 1);
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
    if (!isActive) return;
    onSelectionChange([...sortedHand]);
    lastSelectedIndex.current = -1;
  };

  const handleClearSelection = () => {
    if (!isActive) return;
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

  return (
    <div className="mt-2">
      {/* Status bar above hand */}
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-3">
          {isActive && (
            <div className="font-pixel-display text-[10px] text-glow-gold">
              YOUR TURN
            </div>
          )}
          <div className="font-pixel-body text-base text-bone/70">
            {showCardCount && <>{sortedHand.length} cards</>}
            {selectedCards.length > 0 && (
              <>
                {" "}
                · <span className="text-glow-cyan">{selectedCards.length} selected</span>
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
        {isActive && hand.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearSelection}
              disabled={selectedCards.length === 0}
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
        )}
      </div>

      {/* Hand fan */}
      {hand.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <div className="font-pixel-display text-[11px] text-glow-gold">
            🎉 NO CARDS — YOU WIN!
          </div>
        </div>
      ) : (
        <div
          className="relative flex items-end justify-center pb-4"
          style={{ height: 110 }}
        >
          {sortedHand.map((card, i) => {
            const isSel = isCardSelected(card);
            const mid = (sortedHand.length - 1) / 2;
            const offset = (i - mid) * 38;
            return (
              <div
                key={card.id}
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 0,
                  transform: `translateX(calc(-50% + ${offset}px)) rotate(${(i - mid) * 1.5}deg)`,
                  transformOrigin: "bottom center",
                  zIndex: i,
                }}
              >
                <PixelCard
                  rank={card.rank}
                  suit={card.suit}
                  size="medium"
                  selected={isSel}
                  selectable={isActive}
                  onClick={() => toggleCardSelection(card)}
                />
              </div>
            );
          })}
        </div>
      )}

      {!isActive && hand.length > 0 && (
        <div className="text-center font-pixel-body text-sm text-bone/50 mt-1">
          Waiting for your turn...
        </div>
      )}
    </div>
  );
};

export default PlayerHand;
