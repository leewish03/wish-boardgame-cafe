// =========================================================================
// Web Audio API Synthesizer SFX Engine (Zero external dependencies)
// =========================================================================

class SFXEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicEnabled = true;
    this.musicVolume = 0.15;
    this.sfxVolume = 1;
    this.ambienceNode = null;
    try {
      const saved = JSON.parse(localStorage.getItem('wish_audio_v1') || '{}');
      if (typeof saved.musicEnabled === 'boolean') this.musicEnabled = saved.musicEnabled;
      if (typeof saved.musicVolume === 'number') this.musicVolume = saved.musicVolume;
      if (typeof saved.sfxEnabled === 'boolean') this.enabled = saved.sfxEnabled;
      if (typeof saved.sfxVolume === 'number') this.sfxVolume = saved.sfxVolume;
    } catch (_) {}
  }

  persist() {
    try { localStorage.setItem('wish_audio_v1', JSON.stringify({ musicEnabled: this.musicEnabled, musicVolume: this.musicVolume, sfxEnabled: this.enabled, sfxVolume: this.sfxVolume })); } catch (_) {}
  }

  getAudioContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(val) {
    this.enabled = !!val;
    this.persist();
  }

  setMusicEnabled(val) {
    this.musicEnabled = !!val;
    if (this.musicEnabled) this.startSalonAmbience(); else this.stopSalonAmbience();
    this.persist();
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.ambienceNode?.gain && this.ctx) this.ambienceNode.gain.gain.linearRampToValueAtTime(this.musicVolume * 0.12, this.ctx.currentTime + 0.15);
    this.persist();
  }

  getSettings() { return { musicEnabled: this.musicEnabled, musicVolume: this.musicVolume, sfxEnabled: this.enabled, sfxVolume: this.sfxVolume }; }

  unlockAndStart() {
    this.getAudioContext();
    if (this.musicEnabled) this.startSalonAmbience();
  }

  duckMusic(durationMs = 220) {
    if (!this.ambienceNode?.gain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const target = this.musicVolume * 0.048;
    this.ambienceNode.gain.gain.cancelScheduledValues(now);
    this.ambienceNode.gain.gain.linearRampToValueAtTime(target, now + 0.04);
    this.ambienceNode.gain.gain.linearRampToValueAtTime(this.musicVolume * 0.12, now + durationMs / 1000);
  }

  isEnabled() {
    return this.enabled;
  }

  // 1. Card Draw Sound (Subtle card slide swoosh with filtered noise)
  playCardDraw() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.15; // 150ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(3000, now + 0.15);
      filter.Q.setValueAtTime(3, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.15);
    } catch (e) {
      console.warn('SFX Draw Error:', e);
    }
  }

  // 2. Card Play Sound (Tactile snap & table thud punch)
  playCardPlay() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Low frequency table punch
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.09);

      oscGain.gain.setValueAtTime(0.3, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);

      // Snappy noise click
      const bufferSize = ctx.sampleRate * 0.04;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(2500, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.04);
    } catch (e) {
      console.warn('SFX Play Error:', e);
    }
  }

  // 3. Turn Alert Chime (Clear two-tone bell: 880Hz -> 1760Hz)
  playTurnAlert() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      [
        { freq: 880, start: now, dur: 0.16 },
        { freq: 1760, start: now + 0.1, dur: 0.22 },
      ].forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + dur);
      });
    } catch (e) {
      console.warn('SFX Turn Error:', e);
    }
  }

  // 4. Guard Snipe Success / Hit Sound (Rising pitch glissando)
  playSnipeSuccess() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.3);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('SFX Snipe Error:', e);
    }
  }

  // 6. Clock Tick Sound (Urgent 5-second countdown wooden tick)
  playClockTick() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.035);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.035);
    } catch (e) {
      console.warn('SFX Clock Tick Error:', e);
    }
  }

  // 7. Web Haptics (Vibration API)
  hapticTap() {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch (e) {}
  }

  hapticSnap() {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }
    } catch (e) {}
  }

  hapticImpact() {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
    } catch (e) {}
  }

  // 8. Procedural Salon Ambience BGM (Subtle low-pass drone & acoustic warmth)
  startSalonAmbience() {
    if (this.ambienceNode || !this.musicEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(110, now); // A2

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(164.81, now); // E3

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(this.musicVolume * 0.12, now + 2.0); // Gentle fade-in

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);

      this.ambienceNode = { osc1, osc2, gain };
    } catch (e) {
      console.warn('SFX Ambience Start Error:', e);
    }
  }

  stopSalonAmbience() {
    if (!this.ambienceNode) return;
    try {
      const ctx = this.getAudioContext();
      if (ctx) {
        const now = ctx.currentTime;
        this.ambienceNode.gain.gain.linearRampToValueAtTime(0.001, now + 1.0);
        setTimeout(() => {
          if (this.ambienceNode) {
            this.ambienceNode.osc1.stop();
            this.ambienceNode.osc2.stop();
            this.ambienceNode = null;
          }
        }, 1100);
      } else {
        this.ambienceNode = null;
      }
    } catch (e) {
      this.ambienceNode = null;
    }
  }
}

export const sfx = new SFXEngine();
