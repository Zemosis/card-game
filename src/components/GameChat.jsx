// GAME CHAT COMPONENT - Chat and Game Log Display

import React, { useState, useEffect, useRef } from "react";

const GameChat = ({
  messages = [],
  onSendMessage,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Only scroll if we are not collapsed
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

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700 relative">
      {/* Header */}
      <button
        onClick={onToggleCollapse}
        className="h-12 px-3 border-b border-gray-700 bg-gray-800 w-full flex items-center justify-between hover:bg-gray-750 transition-colors focus:outline-none shrink-0"
      >
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <span>💬</span>
          {isCollapsed ? "Show Chat" : "Chat & Log"}
        </h3>
        <span
          className="text-gray-400 text-xs transform transition-transform duration-300"
          style={{ transform: isCollapsed ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▼
        </span>
      </button>

      {/* Body */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages Area with Invisible Scrollbar */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-900/80 no-scrollbar">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 text-xs mt-4">
              Game started. Good luck!
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`text-sm ${msg.type === "SYSTEM" ? "opacity-80" : ""}`}
            >
              {msg.type === "SYSTEM" && (
                <div className="flex gap-2 text-xs">
                  <span className="text-gray-500 font-mono min-w-[35px]">
                    {msg.timestamp}
                  </span>
                  <span className="text-gray-300 italic">{msg.text}</span>
                </div>
              )}

              {msg.type === "CHAT" && (
                <div
                  className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span
                      className={`text-xs font-bold ${msg.isMe ? "text-blue-400" : "text-yellow-400"}`}
                    >
                      {msg.sender}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {msg.timestamp}
                    </span>
                  </div>
                  <div
                    className={`
                    px-3 py-1.5 rounded-lg max-w-[90%] break-words
                    ${
                      msg.isMe
                        ? "bg-blue-600 text-white rounded-tr-none"
                        : "bg-gray-700 text-gray-200 rounded-tl-none"
                    }
                  `}
                  >
                    {msg.text}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSend}
          className="p-2 border-t border-gray-700 bg-gray-800 shrink-0"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white px-3 py-1.5 rounded text-sm font-bold transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Standard CSS Style Tag (Works in all browsers/React setups) */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}</style>
    </div>
  );
};

export default GameChat;
