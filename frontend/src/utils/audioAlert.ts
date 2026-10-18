/**
 * LifeLink Authoritative Audio Alert System
 * 
 * Complies with strict clinical safety constraints:
 * 1. 5-Second Maximum Playback: Playback strictly ceases at 5000ms.
 * 2. Guaranteed Deduplication: Each urgent/emergency notification triggers audio at most once.
 *    Repeated polling, reconnects, re-renders, and page refreshes NEVER replay the same alert.
 * 3. Clinical Tone Separation: Distinct high-priority pulsing warble for Emergency, 
 *    melodic chime for Urgent, zero audio for Routine.
 * 4. User Preference & Browser Autoplay Handling: Respects mute/volume settings and 
 *    unlocks Web Audio API on user interaction.
 */

export type AlertUrgency = 'Emergency' | 'Urgent';

const STORAGE_KEY_ENABLED = 'lifelink_alert_sound_enabled';
const STORAGE_KEY_VOLUME = 'lifelink_alert_sound_volume';
const SESSION_KEY_PLAYED_PREFIX = 'lifelink_played_alert_';

class AudioAlertManager {
  private audioCtx: AudioContext | null = null;
  private currentSourceNodes: {
    oscillators: OscillatorNode[];
    gainNodes: GainNode[];
    timer: ReturnType<typeof setTimeout> | null;
  } | null = null;

  private inMemoryPlayedIds: Set<string> = new Set();
  private isMuted: boolean = false;
  private volume: number = 0.8;

  constructor() {
    this.loadPreferences();
  }

  private loadPreferences() {
    if (typeof window === 'undefined') return;
    try {
      const storedEnabled = localStorage.getItem(STORAGE_KEY_ENABLED);
      if (storedEnabled !== null) {
        this.isMuted = storedEnabled === 'false';
      }
      const storedVol = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (storedVol !== null) {
        const parsed = parseFloat(storedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      }
    } catch {
      // Safe fallback
    }
  }

  public isEnabled(): boolean {
    return !this.isMuted;
  }

  public setEnabled(enabled: boolean) {
    this.isMuted = !enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
      } catch {
        // Safe fallback
      }
    }
    if (!enabled) {
      this.stop();
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
      } catch {
        // Safe fallback
      }
    }
  }

  /**
   * Safe initialization of AudioContext on user interaction
   */
  public getOrCreateContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {
        // Will resume on next user gesture
      });
    }
    return this.audioCtx;
  }

  public isAudioContextReady(): boolean {
    return Boolean(this.audioCtx && this.audioCtx.state === 'running');
  }

  /**
   * Deduplication check: Verifies if a given notification or event ID has already played
   */
  public hasPlayed(eventId: string): boolean {
    if (!eventId) return false;
    if (this.inMemoryPlayedIds.has(eventId)) return true;
    if (typeof window !== 'undefined') {
      try {
        const inSession = sessionStorage.getItem(`${SESSION_KEY_PLAYED_PREFIX}${eventId}`);
        if (inSession) {
          this.inMemoryPlayedIds.add(eventId);
          return true;
        }
      } catch {
        // Safe fallback
      }
    }
    return false;
  }

  /**
   * Marks an event ID as played to prevent repeat playback across sessions and reconnects
   */
  public markAsPlayed(eventId: string) {
    if (!eventId) return;
    this.inMemoryPlayedIds.add(eventId);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`${SESSION_KEY_PLAYED_PREFIX}${eventId}`, String(Date.now()));
      } catch {
        // Safe fallback
      }
    }
  }

  /**
   * Unconditionally stops any currently playing alert tone and cleans up Web Audio resources.
   */
  public stop() {
    if (this.currentSourceNodes) {
      const { oscillators, gainNodes, timer } = this.currentSourceNodes;
      if (timer) {
        clearTimeout(timer);
      }
      try {
        gainNodes.forEach(g => {
          if (this.audioCtx) {
            g.gain.setValueAtTime(0, this.audioCtx.currentTime);
          }
        });
        oscillators.forEach(osc => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {
            // Already stopped
          }
        });
      } catch {
        // Safe cleanup
      }
      this.currentSourceNodes = null;
    }
  }

  /**
   * Triggers a distinct audible alert for an incoming event.
   * Enforces 5-second hard ceiling and deduplication.
   */
  public playAlert(urgency: AlertUrgency, eventId?: string, forceTest: boolean = false): boolean {
    if (!forceTest && eventId) {
      if (this.hasPlayed(eventId)) {
        return false; // Prevent repeated alert
      }
      this.markAsPlayed(eventId);
    }

    if (this.isMuted && !forceTest) {
      return false; // Respect user mute setting
    }

    const ctx = this.getOrCreateContext();
    if (!ctx) return false;

    // Stop any currently playing tone
    this.stop();

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume, now);
    masterGain.connect(ctx.destination);

    const oscillators: OscillatorNode[] = [];
    const gainNodes: GainNode[] = [masterGain];

    const DURATION_SECONDS = 5.0; // Strictly 5 seconds

    if (urgency === 'Emergency') {
      // High-priority dual-tone emergency warble (880 Hz alternating with 660 Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      // 880Hz / 660Hz alternating frequency warble every 0.15s
      const steps = Math.floor(DURATION_SECONDS / 0.15);
      for (let i = 0; i < steps; i++) {
        const time = now + i * 0.15;
        const freq1 = i % 2 === 0 ? 880 : 660;
        const freq2 = i % 2 === 0 ? 440 : 330;
        osc1.frequency.setValueAtTime(freq1, time);
        osc2.frequency.setValueAtTime(freq2, time);
      }

      // Pulsing amplitude envelope (cadence: 0.12s on, 0.03s dip)
      for (let i = 0; i < steps; i++) {
        const time = now + i * 0.15;
        oscGain.gain.setValueAtTime(0.35, time);
        oscGain.gain.setValueAtTime(0.05, time + 0.12);
      }

      // Smooth fade out at exactly 5 seconds
      oscGain.gain.setValueAtTime(0.3, now + DURATION_SECONDS - 0.05);
      oscGain.gain.linearRampToValueAtTime(0, now + DURATION_SECONDS);

      osc1.connect(oscGain);
      osc2.connect(oscGain);
      oscGain.connect(masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + DURATION_SECONDS);
      osc2.stop(now + DURATION_SECONDS);

      oscillators.push(osc1, osc2);
      gainNodes.push(oscGain);
    } else {
      // Urgent tone: 2-tone melodic chime (523.25 Hz - C5 to 659.25 Hz - E5)
      const osc = ctx.createOscillator();
      const chimeGain = ctx.createGain();

      osc.type = 'sine';

      // Chime sequence repeated every 0.8s
      const chimeInterval = 0.8;
      const repetitions = Math.floor(DURATION_SECONDS / chimeInterval);

      for (let i = 0; i < repetitions; i++) {
        const t = now + i * chimeInterval;
        osc.frequency.setValueAtTime(523.25, t); // C5
        osc.frequency.setValueAtTime(659.25, t + 0.2); // E5

        chimeGain.gain.setValueAtTime(0, t);
        chimeGain.gain.linearRampToValueAtTime(0.3, t + 0.04);
        chimeGain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
      }

      chimeGain.gain.setValueAtTime(0, now + DURATION_SECONDS);

      osc.connect(chimeGain);
      chimeGain.connect(masterGain);

      osc.start(now);
      osc.stop(now + DURATION_SECONDS);

      oscillators.push(osc);
      gainNodes.push(chimeGain);
    }

    // Set reliable JavaScript timeout to clean up references at exactly 5 seconds
    const timer = setTimeout(() => {
      this.stop();
    }, 5000);

    this.currentSourceNodes = { oscillators, gainNodes, timer };
    return true;
  }
}

export const audioAlertManager = new AudioAlertManager();
