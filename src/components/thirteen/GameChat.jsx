// GAME CHAT - Pixel Retro Style

import React, { useState, useEffect, useRef } from "react";
import { PixelAvatar } from "../PixelCard";

const GameChat = ({
  messages = [],
  onSendMessage,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [inputText, setInputText] = useState("");
  const [tab, setTab] = useState("chat");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!isCollapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isCollapsed]);

  const handleSend = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText("");
    }
  };

  const quickReplies = ["gg", "wp", "oof", "lol", "nice", "?"];

  const chatMessages = messages.filter((m) => m.type !== "SYSTEM");
  const logMessages = messages.filter((m) => m.type === "SYSTEM");
  const visibleMessages = tab === "log" ? logMessages : chatMessages;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div
        className="px-3 py-2 font-pixel-display text-[10px] tracking-wider flex items-center justify-between cursor-pointer"
        style={{ backgroundColor: "#1a1024", color: "#5fd4d6" }}
        onClick={onToggleCollapse}
      >
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTab("chat");
            }}
            style={{ color: tab === "chat" ? "#5fd4d6" : "#7a6abf" }}
          >
            ✉ CHAT
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTab("log");
            }}
            style={{ color: tab === "log" ? "#5fd4d6" : "#7a6abf" }}
          >
            ☰ LOG
          </button>
        </div>
        <span className="text-bone/60 text-[8px]">
          {visibleMessages.length} MSGS {isCollapsed ? "▲" : "▼"}
        </span>
      </div>

      {!isCollapsed && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2 text-sm">
            {visibleMessages.length === 0 && (
              <div className="font-pixel-body text-sm text-bone/40 italic text-center py-4">
                {tab === "log"
                  ? "Moves will be logged here."
                  : "Game started. Good luck!"}
              </div>
            )}
            {visibleMessages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="p-2 flex gap-1.5"
            style={{
              borderTop: "3px solid #1f1a3d",
              backgroundColor: "#14102a",
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Say something..."
              className="flex-1 font-pixel-body text-base px-2 py-2 text-parchment"
              style={{
                backgroundColor: "#0a0712",
                border: "2px solid #1f1a3d",
                boxShadow: "inset 0 2px 0 0 rgba(0,0,0,0.5)",
              }}
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="pixel-btn font-pixel-display text-[10px] px-3"
              style={{
                backgroundColor: "#5fd4d6",
                borderColor: "#2a8a8c",
                color: "#0a3a3a",
              }}
            >
              ►
            </button>
          </form>
          {/* Quick replies */}
          <div className="px-2 pb-2 flex gap-1 flex-wrap">
            {quickReplies.map((q) => (
              <button
                key={q}
                onClick={() => onSendMessage(q)}
                className="font-pixel-body text-xs px-2 py-1"
                style={{
                  backgroundColor: "#1f1a3d",
                  color: "#bbb",
                  border: "2px solid #0a0712",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

function ChatMessage({ msg }) {
  if (msg.type === "SYSTEM") {
    return (
      <div className="font-pixel-body text-sm text-bone/60 italic px-2">
        <span className="text-mist">› </span>
        {msg.text}{" "}
        <span className="text-bone/30 text-xs">{msg.timestamp}</span>
      </div>
    );
  }
  return (
    <div className={`flex gap-2 ${msg.isMe ? "flex-row-reverse" : ""}`}>
      <PixelAvatar variant={msg.isMe ? "me" : 2} size={24} />
      <div className="max-w-[80%]">
        <div
          className={`flex items-center gap-1 ${msg.isMe ? "justify-end" : ""}`}
        >
          <span
            className="font-pixel-display text-[9px]"
            style={{ color: msg.isMe ? "#5fd4d6" : "#f4c430" }}
          >
            {msg.sender}
          </span>
          <span className="font-pixel-body text-xs text-bone/40">
            {msg.timestamp}
          </span>
        </div>
        <div
          className="font-pixel-body text-base px-2 py-1 mt-0.5"
          style={{
            backgroundColor: msg.isMe ? "#2a8a8c" : "#1f1a3d",
            color: msg.isMe ? "#0a3a3a" : "#ead8b1",
            border: "2px solid #0a0712",
          }}
        >
          {msg.text}
        </div>
      </div>
    </div>
  );
}

export default GameChat;
