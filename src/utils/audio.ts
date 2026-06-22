export enum SoundscapeTheme {
  OFF = 'OFF',
  RETRO = 'RETRO',
  LOFI = 'LOFI',
  CYBERPUNK = 'CYBERPUNK'
}

class SoundSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private currentTheme: SoundscapeTheme = SoundscapeTheme.OFF;

  // Background music scheduler variables
  private sequencerIntervalId: any = null;
  private nextNoteTime: number = 0;
  private currentStep: number = 0;
  private lookaheadMs: number = 50; // review frequency
  private scheduleAheadSeconds: number = 0.15; // window of planning
  private tempoBpm: number = 100;

  constructor() {
    try {
      const storedMute = localStorage.getItem('flappy_muted');
      if (storedMute !== null) {
        this.isMuted = storedMute === 'true';
      }
      
      const storedTheme = localStorage.getItem('sky_soundscape_theme');
      if (storedTheme !== null) {
        this.currentTheme = storedTheme as SoundscapeTheme;
      }
    } catch (e) {
      // Ignore localStorage blocks safely
    }
  }

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('flappy_muted', String(this.isMuted));
    } catch (e) {
      // Ignore
    }

    if (this.isMuted) {
      this.stopSequencer();
    } else {
      this.restartSequencer();
    }

    return this.isMuted;
  }

  public getMuteState() {
    return this.isMuted;
  }

  public getSoundscape() {
    return this.currentTheme;
  }

  public setSoundscape(theme: SoundscapeTheme) {
    this.currentTheme = theme;
    try {
      localStorage.setItem('sky_soundscape_theme', theme);
    } catch (e) {
      // Ignore
    }

    this.restartSequencer();
  }

  private restartSequencer() {
    this.stopSequencer();
    if (this.isMuted || this.currentTheme === SoundscapeTheme.OFF) {
      return;
    }

    this.init();
    if (!this.ctx) return;

    // Apply Tempo by soundscape
    if (this.currentTheme === SoundscapeTheme.RETRO) {
      this.tempoBpm = 130; // fast arcade
    } else if (this.currentTheme === SoundscapeTheme.LOFI) {
      this.tempoBpm = 80;  // cozy slow tempo
    } else if (this.currentTheme === SoundscapeTheme.CYBERPUNK) {
      this.tempoBpm = 115; // energetic syncopation
    }

    this.nextNoteTime = this.ctx.currentTime;
    this.currentStep = 0;

    const tick = () => {
      if (!this.ctx || this.isMuted || this.currentTheme === SoundscapeTheme.OFF) {
        return;
      }

      const secondsPerBeat = 60.0 / this.tempoBpm;
      const stepDuration = secondsPerBeat * 0.25; // 16th notes or 8th notes

      while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadSeconds) {
        this.scheduleSoundscapeStep(this.currentStep, this.nextNoteTime);
        this.nextNoteTime += stepDuration;
        this.currentStep = (this.currentStep + 1) % 16;
      }

      this.sequencerIntervalId = setTimeout(tick, this.lookaheadMs);
    };

    tick();
  }

  private stopSequencer() {
    if (this.sequencerIntervalId) {
      clearTimeout(this.sequencerIntervalId);
      this.sequencerIntervalId = null;
    }
  }

  // Trigger procedural audio synthesizers based on current Soundscape stage
  private scheduleSoundscapeStep(step: number, time: number) {
    if (!this.ctx || this.isMuted) return;

    try {
      if (this.currentTheme === SoundscapeTheme.RETRO) {
        // High upbeat 8-bit pentatonic scale loop
        const pentatonic = [196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // G3, A3, C4, D4, E4, G4, A4, C5
        
        let pitchIndex = step % 8;
        if (step === 3 || step === 11) pitchIndex = (step * 2) % 8;
        if (step === 7 || step === 15) pitchIndex = 5;

        // Schedule only on specific rhythmic cues
        if (step % 2 === 0) {
          const freq = pentatonic[pitchIndex];
          this.playSynthNote(freq, 'triangle', 0.02, 0.12, time);
        }

        // Bass/Snare chip pulse
        if (step % 4 === 0) {
          this.playSynthNote(98.00, 'square', 0.015, 0.08, time);
        }
      } 
      else if (this.currentTheme === SoundscapeTheme.LOFI) {
        // Cozy jazz minor third chill progress pads
        // Chords: Am7 (A2, C3, E3, G3, B3) -> Em7 (E2, G2, B2, D3, F#3)
        const chordA = [110.00, 130.81, 164.81, 196.00, 246.94];
        const chordE = [82.41, 98.00, 123.47, 146.83, 185.00];

        // Trigger heavy pad notes on beat 0 and beat 8 of 16-step grid
        if (step === 0) {
          chordA.forEach((freq, idx) => {
            this.playSynthNote(freq, 'sine', 0.012 - idx * 0.001, 1.6, time);
          });
        } else if (step === 8) {
          chordE.forEach((freq, idx) => {
            this.playSynthNote(freq, 'sine', 0.012 - idx * 0.001, 1.6, time);
          });
        }

        // Subtle lo-fi tick high-hat noise simulation
        if (step % 4 === 2) {
          this.playSynthNote(800, 'sine', 0.003, 0.02, time);
        }
      } 
      else if (this.currentTheme === SoundscapeTheme.CYBERPUNK) {
        // Driving modular heavy bassline spells
        // Bassline sequence in key of A minor
        const cyberpunkBass = [
          55.00,  55.00,  110.00, 55.00,
          65.41,  65.41,  130.81, 65.41,
          73.42,  73.42,  146.83, 73.42,
          82.41,  82.41,  164.81, 82.41
        ];

        const freq = cyberpunkBass[step % cyberpunkBass.length];
        
        // Heavy saw wave note
        if (step % 2 === 0) {
          this.playCyberpunkBassNote(freq, time);
        }

        // Metallic digital high-hat pulse
        if (step % 8 === 4) {
          this.playSynthNote(1200, 'triangle', 0.006, 0.04, time);
        }
      }
    } catch (e) {
      // Fail-safe
    }
  }

  // Play micro synth sound with volume curves
  private playSynthNote(freq: number, type: OscillatorType, maxGain: number, duration: number, time: number) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(maxGain, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + duration);
    } catch (e) {
      // Ignore
    }
  }

  private playCyberpunkBassNote(freq: number, time: number) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, time);
      filter.frequency.exponentialRampToValueAtTime(320, time + 0.08);
      filter.Q.setValueAtTime(3, time);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.04, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.18);
    } catch (e) {
      // Ignore
    }
  }

  public playFlap() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(360, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  public playScore() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.06, now);
      gain1.gain.exponentialRampToValueAtTime(0.002, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start();
      osc1.stop(now + 0.12);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, now + 0.06); // E5
      gain2.gain.setValueAtTime(0.06, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.002, now + 0.18);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.18);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  public playHit() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.22);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(now + 0.22);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  public playGameOver() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.5);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.5);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(now + 0.5);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }
}

export const soundSystem = new SoundSystem();
