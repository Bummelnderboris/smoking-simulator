// Audio system using Web Audio API for retro sounds and music
export class AudioSystem {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.initialized = false;
        this.musicPlaying = false;
        this.currentNoteIndex = 0;
        this.nextNoteTime = 0;
        this.tempo = 120;
        this.drunkLevel = 0;

        // 80s style background music - simple looping melody
        this.melody = [
            { note: 'C4', duration: 0.25 },
            { note: 'E4', duration: 0.25 },
            { note: 'G4', duration: 0.25 },
            { note: 'E4', duration: 0.25 },
            { note: 'C4', duration: 0.25 },
            { note: 'D4', duration: 0.25 },
            { note: 'E4', duration: 0.5 },
            { note: 'G4', duration: 0.25 },
            { note: 'A4', duration: 0.25 },
            { note: 'G4', duration: 0.25 },
            { note: 'E4', duration: 0.25 },
            { note: 'D4', duration: 0.5 },
            { note: 'C4', duration: 0.5 },
        ];

        this.bassLine = [
            { note: 'C2', duration: 1 },
            { note: 'G2', duration: 1 },
            { note: 'A2', duration: 1 },
            { note: 'G2', duration: 1 },
        ];

        // Note frequencies
        this.frequencies = {
            'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
            'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
            'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
            'C5': 523.25, 'D5': 587.33, 'E5': 659.25
        };

        this.bassNoteIndex = 0;
        this.nextBassTime = 0;
    }

    async init() {
        if (this.initialized) return;

        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // Master volume
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);

            // Music channel
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.4;
            this.musicGain.connect(this.masterGain);

            // SFX channel
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.6;
            this.sfxGain.connect(this.masterGain);

            this.initialized = true;
            console.log('Audio system initialized');
        } catch (e) {
            console.warn('Audio not available:', e);
        }
    }

    // Resume audio context (needed after user interaction)
    async resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    // Play a simple tone
    playTone(frequency, duration, type = 'square', gainNode = this.sfxGain) {
        if (!this.initialized || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.value = frequency;

        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(gainNode);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + duration);
    }

    // Play a note by name
    playNote(noteName, duration, type = 'square', gainNode = this.sfxGain) {
        const freq = this.frequencies[noteName];
        if (freq) {
            this.playTone(freq, duration, type, gainNode);
        }
    }

    // Sound effects
    playSmokeSound() {
        if (!this.initialized) return;

        // Breathy noise for inhale
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            // Filtered noise
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3)) * 0.3;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        source.connect(filter);
        filter.connect(this.sfxGain);
        source.start();
    }

    playHiccupSound() {
        if (!this.initialized) return;

        // Hiccup - quick up-down pitch
        this.playTone(250, 0.08, 'sine');
        setTimeout(() => {
            this.playTone(400, 0.05, 'sine');
        }, 60);
        setTimeout(() => {
            this.playTone(200, 0.1, 'sine');
        }, 110);
    }

    playDrinkSound() {
        if (!this.initialized) return;

        // Gulp sound - descending tones
        const times = [0, 0.08, 0.16];
        const freqs = [400, 300, 200];

        times.forEach((time, i) => {
            setTimeout(() => {
                this.playTone(freqs[i], 0.1, 'sine');
            }, time * 1000);
        });
    }

    playStuffSuccessSound() {
        if (!this.initialized) return;

        // Happy ascending arpeggio
        const notes = ['C4', 'E4', 'G4', 'C5'];
        notes.forEach((note, i) => {
            setTimeout(() => {
                this.playNote(note, 0.15, 'square');
            }, i * 80);
        });
    }

    playStuffFailSound() {
        if (!this.initialized) return;

        // Sad descending sound
        this.playTone(200, 0.3, 'sawtooth');
        setTimeout(() => {
            this.playTone(150, 0.3, 'sawtooth');
        }, 150);
    }

    playKeyPressSound(correct) {
        if (!this.initialized) return;

        if (correct) {
            this.playTone(600, 0.05, 'square');
        } else {
            this.playTone(150, 0.1, 'sawtooth');
        }
    }

    playGameOverSound() {
        if (!this.initialized) return;

        // Sad descending melody
        const notes = ['G4', 'E4', 'C4', 'G3'];
        notes.forEach((note, i) => {
            setTimeout(() => {
                this.playNote(note, 0.4, 'triangle');
            }, i * 300);
        });
    }

    playWarningBeep() {
        if (!this.initialized) return;
        this.playTone(800, 0.1, 'square');
    }

    // Background music scheduler
    startMusic() {
        if (!this.initialized || this.musicPlaying) return;

        this.musicPlaying = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.nextBassTime = this.ctx.currentTime;
        this.scheduleMusic();
    }

    stopMusic() {
        this.musicPlaying = false;
    }

    // Set drunk level for audio effects
    setDrunkLevel(level) {
        this.drunkLevel = level;

        // Adjust tempo slightly when drunk
        if (level >= 85) {
            this.tempo = 120 + Math.sin(Date.now() / 1000) * 10; // Wavering tempo
        } else {
            this.tempo = 120;
        }
    }

    scheduleMusic() {
        if (!this.musicPlaying || !this.ctx) return;

        const currentTime = this.ctx.currentTime;
        const beatLength = 60 / this.tempo;

        // Schedule melody notes
        while (this.nextNoteTime < currentTime + 0.2) {
            const note = this.melody[this.currentNoteIndex];
            this.scheduleNote(note.note, this.nextNoteTime, note.duration * beatLength, 'square');
            this.nextNoteTime += note.duration * beatLength;
            this.currentNoteIndex = (this.currentNoteIndex + 1) % this.melody.length;
        }

        // Schedule bass notes
        while (this.nextBassTime < currentTime + 0.2) {
            const note = this.bassLine[this.bassNoteIndex];
            this.scheduleNote(note.note, this.nextBassTime, note.duration * beatLength * 0.8, 'triangle');
            this.nextBassTime += note.duration * beatLength;
            this.bassNoteIndex = (this.bassNoteIndex + 1) % this.bassLine.length;
        }

        // Continue scheduling
        requestAnimationFrame(() => this.scheduleMusic());
    }

    scheduleNote(noteName, time, duration, type) {
        let freq = this.frequencies[noteName];
        if (!freq) return;

        // Apply drunk pitch wobble (85%+ drunk)
        if (this.drunkLevel >= 85) {
            const wobble = 1 + (Math.sin(time * 5) * 0.03 * (this.drunkLevel - 85) / 15);
            freq *= wobble;
        }

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.value = freq;

        // Envelope
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.15, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    setMasterVolume(value) {
        if (this.masterGain) {
            this.masterGain.gain.value = value;
        }
    }

    setMusicVolume(value) {
        if (this.musicGain) {
            this.musicGain.gain.value = value;
        }
    }

    setSfxVolume(value) {
        if (this.sfxGain) {
            this.sfxGain.gain.value = value;
        }
    }
}
