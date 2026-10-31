/**
 * Web Audio API Synthesized Sound Effects (No external assets required)
 * Provides ringtones, message chimes, and notification alert sounds.
 */

class SoundEffectsEngine {
  private audioCtx: AudioContext | null = null;
  private ringtoneInterval: number | null = null;

  private getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play a gentle pop/chime for incoming text messages
  public playMessagePop() {
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  }

  // Play notification alert chime
  public playNotificationChime() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      [523.25, 659.25, 783.99].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);

        gain.gain.setValueAtTime(0.1, now + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.2);
      });
    } catch (e) {
      console.warn('Notification audio failed:', e);
    }
  }

  // Start repeating incoming call telephone ringtone
  public startIncomingRingtone(): () => void {
    const playRing = () => {
      try {
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // Classic dual-tone ring (440Hz & 480Hz)
        [440, 480].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.12, now);
          gain.gain.setValueAtTime(0.12, now + 1.2);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 1.5);
        });
      } catch (e) {
        console.warn('Ringtone failed:', e);
      }
    };

    playRing();
    if (this.ringtoneInterval) window.clearInterval(this.ringtoneInterval);
    this.ringtoneInterval = window.setInterval(playRing, 3000);

    return () => this.stopRingtone();
  }

  public stopRingtone() {
    if (this.ringtoneInterval) {
      window.clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  // Play call connected beep
  public playCallConnected() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.15);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('Call connect sound failed:', e);
    }
  }
}

export const soundEffects = new SoundEffectsEngine();
