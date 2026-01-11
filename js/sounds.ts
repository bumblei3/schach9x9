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

  public playMove(): void {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    // Short, pleasant click sound
    osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.05);

    gain.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.05);
  }

  public playCapture(): void {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    // More aggressive sound for captures
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);

    gain.gain.setValueAtTime(this.volume * 0.8, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    osc.start(this.audioContext.currentTime);
    osc.stop(this.audioContext.currentTime + 0.1);
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
