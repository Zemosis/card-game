// SOUND MANAGER - Synthesized Audio Effects using Web Audio API

class SoundManager {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.isMuted = false;
  }

  // Initialize Audio Context (must be triggered by user interaction first)
  init() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.3; // Default volume 30%
      this.masterGain.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : 0.3;
    }
    return this.isMuted;
  }

  // Generic Tone Generator
  playTone(freq, type, duration, startTime = 0) {
    if (!this.context || this.isMuted) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.context.currentTime + startTime);
    
    gain.gain.setValueAtTime(0.1, this.context.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.context.currentTime + startTime);
    osc.stop(this.context.currentTime + startTime + duration);
  }

  // --- GAME SFX ---

  // Card Snap (Sharp, crisp sound)
  playSnap() {
    if (!this.context || this.isMuted) return;
    
    // High frequency impact
    this.playTone(800, 'triangle', 0.1);
    // Lower body
    this.playTone(200, 'sine', 0.15);
  }

  // Card Deal / Shuffle (Quick "thwip")
  playDeal() {
    if (!this.context || this.isMuted) return;
    
    // Quick burst of noise (simulated by rapid random frequency)
    this.playTone(Math.random() * 1000 + 500, 'square', 0.05);
  }

  // Success / Victory Jingle
  playVictory() {
    if (!this.context || this.isMuted) return;
    
    const now = 0;
    this.playTone(523.25, 'sine', 0.2, now);       // C5
    this.playTone(659.25, 'sine', 0.2, now + 0.15); // E5
    this.playTone(783.99, 'sine', 0.4, now + 0.3);  // G5
    this.playTone(1046.50, 'square', 0.6, now + 0.45); // C6
  }

  // Turn Notification (Soft ding)
  playTurnAlert() {
    if (!this.context || this.isMuted) return;
    this.playTone(880, 'sine', 0.5); // A5
  }

  // Chat Notification (Bubble pop)
  playChat() {
    if (!this.context || this.isMuted) return;
    this.playTone(1200, 'sine', 0.1);
  }

  // Error / Invalid Move (Low buzz)
  playError() {
    if (!this.context || this.isMuted) return;
    this.playTone(150, 'sawtooth', 0.3);
  }

  // Click / Select (Subtle click)
  playClick() {
    if (!this.context || this.isMuted) return;
    this.playTone(1200, 'triangle', 0.05);
  }
}

// Export singleton instance
export const soundManager = new SoundManager();
