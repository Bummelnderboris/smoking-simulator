import { KEYS } from '../utils/constants.js';

export class InputHandler {
    constructor() {
        this.keys = new Map();
        this.justPressed = new Map();
        this.pendingInputs = [];
        this.drunkLevel = 0;

        this.setupListeners();
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();

            // Prevent default for game keys
            if (key === ' ' || key === 'b' || KEYS.STUFF_KEYS.includes(key)) {
                e.preventDefault();
            }

            if (!this.keys.get(key)) {
                this.justPressed.set(key, true);
            }
            this.keys.set(key, true);
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys.set(key, false);
        });

        // Handle window blur - release all keys
        window.addEventListener('blur', () => {
            this.keys.clear();
            this.justPressed.clear();
        });
    }

    // Check if key is currently held
    isHeld(key) {
        return this.keys.get(key.toLowerCase()) || false;
    }

    // Check if key was just pressed this frame
    isJustPressed(key) {
        return this.justPressed.get(key.toLowerCase()) || false;
    }

    // Clear just pressed state (call at end of frame)
    clearJustPressed() {
        this.justPressed.clear();
    }

    // Set drunk level for input effects
    setDrunkLevel(level) {
        this.drunkLevel = level;
    }

    // Get potentially scrambled input (for drunk effects)
    getScrambledKey(intendedKey) {
        if (this.drunkLevel < 2) return intendedKey;

        // At drunk level 2+, occasionally swap WASD keys
        const swapChance = (this.drunkLevel - 1) * 0.15;

        if (Math.random() < swapChance && KEYS.STUFF_KEYS.includes(intendedKey)) {
            const otherKeys = KEYS.STUFF_KEYS.filter(k => k !== intendedKey);
            return otherKeys[Math.floor(Math.random() * otherKeys.length)];
        }

        return intendedKey;
    }

    // Check if any WASD key was just pressed, return which one
    getStuffingKeyPressed() {
        for (const key of KEYS.STUFF_KEYS) {
            if (this.isJustPressed(key)) {
                return key;
            }
        }
        return null;
    }

    update(deltaTime) {
        // Process pending inputs with delay (drunk effect)
        // For now, keeping it simple - delay is handled by player cooldowns
    }
}
