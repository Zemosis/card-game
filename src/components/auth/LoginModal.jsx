import React, { useState } from "react";
import { PixelButton } from "../PixelCard";
import { useAuth } from "../../hooks/useAuth";
import AvatarPicker from "./AvatarPicker";

const TABS = ["SIGN IN", "SIGN UP"];

export default function LoginModal({ onClose }) {
  const { signIn, signUp, updateProfile } = useAuth();
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Profile setup (after signup)
  const [setupMode, setSetupMode] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupTag, setSetupTag] = useState("");
  const [setupAvatar, setSetupAvatar] = useState(1);

  async function handleSignIn(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email, password);
      onClose();
    } catch (err) {
      setError(err.message || "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await signUp(email, password);
      setSetupMode(true);
    } catch (err) {
      setError(err.message || "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleProfileSetup(e) {
    e.preventDefault();
    setError("");
    if (!setupName.trim()) {
      setError("Enter a name");
      return;
    }
    if (!setupTag.trim()) {
      setError("Enter a tag ID");
      return;
    }
    setBusy(true);
    try {
      await updateProfile({
        username: setupName.toUpperCase().slice(0, 6),
        tag: setupTag.toUpperCase().slice(0, 4),
        avatar: setupAvatar,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Profile setup failed");
    } finally {
      setBusy(false);
    }
  }

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
          width: 380,
          backgroundColor: "#14102a",
          border: "4px solid #c89820",
          boxShadow:
            "0 0 0 4px #0a0712, 0 0 40px rgba(244,196,48,0.2), inset 0 4px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{
            backgroundColor: "#f4c430",
            borderBottom: "4px solid #0a0712",
          }}
        >
          <span
            className="font-pixel-display text-[10px]"
            style={{ color: "#1a1024" }}
          >
            {setupMode ? "✦ CREATE PROFILE ✦" : "✦ CARD-LORE AUTH ✦"}
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

        {setupMode ? (
          /* Profile setup after signup */
          <form onSubmit={handleProfileSetup} className="p-4 flex flex-col gap-4">
            <div className="font-pixel-body text-base text-bone text-center">
              Choose your identity, adventurer.
            </div>

            <AvatarPicker
              selected={setupAvatar}
              onSelect={setSetupAvatar}
            />

            <div>
              <label className="font-pixel-display text-[9px] text-bone/60 block mb-1">
                NAME (6 CHARS)
              </label>
              <input
                value={setupName}
                onChange={(e) =>
                  setSetupName(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6)
                  )
                }
                maxLength={6}
                placeholder="WANDER"
                className="w-full font-pixel-display text-sm px-3 py-2 text-parchment uppercase"
                style={{
                  backgroundColor: "#0a0712",
                  border: "3px solid #1f1a3d",
                  boxShadow: "inset 0 2px 0 0 rgba(0,0,0,0.5)",
                  letterSpacing: "0.15em",
                }}
              />
            </div>

            <div>
              <label className="font-pixel-display text-[9px] text-bone/60 block mb-1">
                TAG ID (4 CHARS)
              </label>
              <div className="flex items-center gap-2">
                <span
                  className="font-pixel-display text-sm text-gold"
                  style={{ textShadow: "1px 1px 0 #000" }}
                >
                  #
                </span>
                <input
                  value={setupTag}
                  onChange={(e) =>
                    setSetupTag(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 4)
                    )
                  }
                  maxLength={4}
                  placeholder="4A2F"
                  className="flex-1 font-pixel-display text-sm px-3 py-2 text-parchment uppercase"
                  style={{
                    backgroundColor: "#0a0712",
                    border: "3px solid #1f1a3d",
                    boxShadow: "inset 0 2px 0 0 rgba(0,0,0,0.5)",
                    letterSpacing: "0.3em",
                  }}
                />
              </div>
            </div>

            {error && (
              <div
                className="font-pixel-display text-[9px] text-center py-2 px-3"
                style={{
                  backgroundColor: "#2a0e18",
                  border: "2px solid #a83a5a",
                  color: "#e85a7a",
                }}
              >
                {error}
              </div>
            )}

            <PixelButton
              color="gold"
              size="lg"
              onClick={handleProfileSetup}
              disabled={busy}
              className="w-full"
            >
              {busy ? "SAVING..." : "► ENTER THE HALL"}
            </PixelButton>
          </form>
        ) : (
          /* Sign In / Sign Up tabs */
          <>
            <div className="flex">
              {TABS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => {
                    setTab(i);
                    setError("");
                  }}
                  className="flex-1 font-pixel-display text-[9px] py-3 text-center"
                  style={{
                    backgroundColor: tab === i ? "#1f1a3d" : "#0a0712",
                    color: tab === i ? "#f4c430" : "#463a78",
                    borderBottom:
                      tab === i
                        ? "3px solid #f4c430"
                        : "3px solid #0a0712",
                    cursor: "pointer",
                    transition: "all 120ms ease",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <form
              onSubmit={tab === 0 ? handleSignIn : handleSignUp}
              className="p-4 flex flex-col gap-3"
            >
              <div>
                <label className="font-pixel-display text-[9px] text-bone/60 block mb-1">
                  EMAIL
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="adventurer@cardlore.gg"
                  required
                  className="w-full font-pixel-body text-base px-3 py-2 text-parchment"
                  style={{
                    backgroundColor: "#0a0712",
                    border: "3px solid #1f1a3d",
                    boxShadow: "inset 0 2px 0 0 rgba(0,0,0,0.5)",
                  }}
                />
              </div>

              <div>
                <label className="font-pixel-display text-[9px] text-bone/60 block mb-1">
                  PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full font-pixel-body text-base px-3 py-2 text-parchment"
                  style={{
                    backgroundColor: "#0a0712",
                    border: "3px solid #1f1a3d",
                    boxShadow: "inset 0 2px 0 0 rgba(0,0,0,0.5)",
                  }}
                />
              </div>

              {tab === 1 && (
                <div>
                  <label className="font-pixel-display text-[9px] text-bone/60 block mb-1">
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full font-pixel-body text-base px-3 py-2 text-parchment"
                    style={{
                      backgroundColor: "#0a0712",
                      border: "3px solid #1f1a3d",
                      boxShadow: "inset 0 2px 0 0 rgba(0,0,0,0.5)",
                    }}
                  />
                </div>
              )}

              {error && (
                <div
                  className="font-pixel-display text-[9px] text-center py-2 px-3"
                  style={{
                    backgroundColor: "#2a0e18",
                    border: "2px solid #a83a5a",
                    color: "#e85a7a",
                  }}
                >
                  {error}
                </div>
              )}

              <PixelButton
                color={tab === 0 ? "gold" : "cyan"}
                size="lg"
                disabled={busy}
                className="w-full"
              >
                {busy
                  ? "LOADING..."
                  : tab === 0
                    ? "► SIGN IN"
                    : "► CREATE ACCOUNT"}
              </PixelButton>

              <div className="font-pixel-body text-sm text-bone/50 text-center mt-1">
                {tab === 0
                  ? "No account? Switch to Sign Up above."
                  : "Already have an account? Switch to Sign In above."}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
