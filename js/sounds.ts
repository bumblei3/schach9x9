// Sound Manager for Chess 9x9
class SoundManager {
  public audioContext: AudioContext | null = null;
  public enabled: boolean = true;
  public volume: number = 0.3;

  constructor() {
    // Ensure a clean state for each instance by removing any persisted settings
    localStorage.removeItem('chess9x9-sound-settings');
    this.loadSettings();
  }

  public init(): void {
    if (!this.audioContext) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
  }

  public loadSettings(): void {
    try {
      const settings = localStorage.getItem('chess9x9-sound-settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        this.enabled = parsed.enabled !== undefined ? parsed.enabled : true;
        this.volume = parsed.volume !== undefined ? parsed.volume : 0.3;
      }
    } catch (e) {
      console.warn('Failed to load sound settings:', e);
    }
  }

  public saveSettings(): void {
    try {
      const settings = {
        enabled: this.enabled,
        volume: this.volume,
      };
      localStorage.setItem('chess9x9-sound-settings', JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save sound settings:', e);
    }
  }

  public setVolume(value: number): void {
    // value should be 0-100
    this.volume = value / 100;
    this.saveSettings();
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    this.saveSettings();
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.saveSettings();
  }

  private getCurrentSkin(): string {
    return localStorage.getItem('chess_skin') || 'classic';
  }

  // Helper: Calculate stereo pan value (-1 to 1) based on board column (0-8 for 9x9)
  private getPanValue(col: number = 4): number {
    // 9 columns: 0 (left) to 8 (right). Center is 4.
    // Map 0..8 to -0.8..0.8 to avoid extreme hard panning
    const normalized = (col - 4) / 4;
    return Math.max(-0.8, Math.min(0.8, normalized));
  }

  public playMove(_fromCol: number = 4, toCol: number = 4): void {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;

    const skin = this.getCurrentSkin();
    // Use target column for panning final sound
    const pan = this.getPanValue(toCol);

    switch (skin) {
      case 'infernale':
        this.playInfernaleMove(pan);
        break;
      case 'frost':
        this.playFrostMove(pan);
        break;
      case 'neon':
        this.playNeonMove(pan);
        break;
      default:
        this.playClassicMove(pan);
        break;
    }
  }

  public playCapture(toCol: number = 4): void {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;

    const skin = this.getCurrentSkin();
    const pan = this.getPanValue(toCol);

    switch (skin) {
      case 'infernale':
        this.playInfernaleCapture(pan);
        break;
      case 'frost':
        this.playFrostCapture(pan);
        break;
      case 'neon':
        this.playNeonCapture(pan);
        break;
      default:
        this.playClassicCapture(pan);
        break;
    }
  }

  // --- Classic Sounds ---

  private playClassicMove(pan: number): void {
    const ctx = this.audioContext!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    // Improved "Wood/Plastic" Click
    // Use a Triangle wave for more body, filtered to sound duller
    osc.type = 'triangle';

    // Variance: +/- 20Hz pitch, +/- 0.05s duration
    const variance = (Math.random() - 0.5) * 40;
    const baseFreq = 300;

    osc.frequency.setValueAtTime(baseFreq + variance, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);

    // Envelope: Sharp attack, short decay
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    if (panner) {
      panner.pan.value = pan;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  private playClassicCapture(pan: number): void {
    const ctx = this.audioContext!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    // Sharper "Snap"
    osc.type = 'square';
    // Variance
    const variance = (Math.random() - 0.5) * 50;

    osc.frequency.setValueAtTime(150 + variance, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(this.volume * 0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    if (panner) {
      panner.pan.value = pan;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  // --- Infernale Sounds (Heavy, Metallic, Deep) ---

  private playInfernaleMove(pan: number): void {
    const ctx = this.audioContext!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100 + Math.random() * 20, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    if (panner) {
      panner.pan.value = pan;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  private playInfernaleCapture(pan: number): void {
    const ctx = this.audioContext!;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.3);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(120, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(this.volume * 0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    // Filter for explosion effect
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.25);

    osc.connect(filter);
    osc2.connect(filter);

    if (panner) {
      panner.pan.value = pan;
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      filter.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.3);
  }

  // --- Frost Sounds (Glassy, High-Pitched) ---

  private playFrostMove(pan: number): void {
    const ctx = this.audioContext!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = 'sine';
    // Slight detune for "icy" feel
    const freq = 1800 + Math.random() * 100;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq - 100, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(this.volume * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    if (panner) {
      panner.pan.value = pan;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  private playFrostCapture(pan: number): void {
    const ctx = this.audioContext!;
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    // Connect gain to panner if available
    if (panner) {
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      gain.connect(ctx.destination);
    }

    // Shattering effect
    const freqs = [2000, 2500, 3200, 4100];
    freqs.forEach(f => {
      const osc = ctx.createOscillator();
      // Variance
      osc.frequency.value = f + (Math.random() * 300 - 150);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1 + Math.random() * 0.1);
    });

    gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  }

  // --- Neon Sounds (Digital, Sci-Fi) ---

  private playNeonMove(pan: number): void {
    const ctx = this.audioContext!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800 + Math.random() * 100, ctx.currentTime + 0.1);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);

    gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    if (panner) {
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      gain.connect(ctx.destination);
    }

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  private playNeonCapture(pan: number): void {
    const ctx = this.audioContext!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = 'square';
    osc.frequency.setValueAtTime(1200 + Math.random() * 200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(this.volume * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    if (panner) {
      panner.pan.value = pan;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(gain);
      gain.connect(ctx.destination);
    }

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  public playCheck(): void {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;

    // Two-tone warning sound
    const times = [0, 0.15];
    times.forEach(time => {
      if (!this.audioContext) return;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.frequency.setValueAtTime(1000, this.audioContext.currentTime + time);

      gain.gain.setValueAtTime(this.volume * 0.6, this.audioContext.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + time + 0.1);

      osc.start(this.audioContext.currentTime + time);
      osc.stop(this.audioContext.currentTime + time + 0.1);
    });
  }

  public playGameStart(): void {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;

    // Ascending arpeggio
    const notes = [523.25, 659.25, 783.99]; // C, E, G
    notes.forEach((freq, i) => {
      if (!this.audioContext) return;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.frequency.setValueAtTime(freq, this.audioContext.currentTime + i * 0.1);

      gain.gain.setValueAtTime(this.volume * 0.5, this.audioContext.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + i * 0.1 + 0.15);

      osc.start(this.audioContext.currentTime + i * 0.1);
      osc.stop(this.audioContext.currentTime + i * 0.1 + 0.15);
    });
  }

  public playGameOver(isWin: boolean): void {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;

    if (isWin) {
      // Victory fanfare
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C, E, G, C
      notes.forEach((freq, i) => {
        if (!this.audioContext) return;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime + i * 0.15);

        gain.gain.setValueAtTime(this.volume * 0.5, this.audioContext.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(
          0.01,
          this.audioContext.currentTime + i * 0.15 + 0.2
        );

        osc.start(this.audioContext.currentTime + i * 0.15);
        osc.stop(this.audioContext.currentTime + i * 0.15 + 0.2);
      });
    } else {
      // Defeat sound
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.5);

      gain.gain.setValueAtTime(this.volume * 0.4, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.5);
    }
  }

  public playSuccess(): void {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    // High-pitched, positive bell-like sound
    osc.frequency.setValueAtTime(880, this.audioContext.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, this.audioContext.currentTime + 0.2); // E6

    gain.gain.setValueAtTime(this.volume * 0.6, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.2);
  }

  public playError(): void {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    // Low-pitched, slightly discordant "buzzer" sound
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.audioContext.currentTime + 0.3);

    gain.gain.setValueAtTime(this.volume * 0.4, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.3);
  }
}

// Global instance
const soundManager = new SoundManager();
export { SoundManager, soundManager };

// Sound-Preloading: Initialisiere AudioContext beim Seitenstart, um Latenz zu minimieren
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Erstes User-Interaktion-Event aktiviert AudioContext (wegen Browser-Policies)
    const unlock = () => {
      soundManager.init();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  });
}
