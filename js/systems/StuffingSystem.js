import { GAME_CONFIG, KEYS } from '../utils/constants.js';
import { randomChoice } from '../utils/helpers.js';

export class StuffingSystem {
    constructor() {
        this.reset();
    }

    reset() {
        this.isActive = false;
        this.sequence = [];
        this.currentIndex = 0;
        this.timeRemaining = 0;
        this.mistakes = 0;
        this.maxMistakes = 3;
        this.lastKeyTime = 0;
        this.success = false;
        this.failed = false;

        // Visual feedback
        this.keyFeedback = null;
    }

    // Start a new stuffing sequence
    start(drunkLevel = 0) {
        this.reset();
        this.isActive = true;

        // Generate random sequence - scales gently with drunk level
        // Base 4, +1 at 50% drunk, +2 at 100% drunk, max 6 keys
        const extraKeys = Math.floor(drunkLevel / 50);
        const length = Math.min(6, GAME_CONFIG.STUFFING_SEQUENCE_LENGTH + extraKeys);
        this.sequence = [];

        for (let i = 0; i < length; i++) {
            this.sequence.push(randomChoice(KEYS.STUFF_KEYS));
        }

        // Adjust time - gentler penalty (max 1.5 second reduction)
        const timePenalty = Math.min(1500, drunkLevel * 15);
        this.timeRemaining = GAME_CONFIG.STUFFING_TIME_LIMIT - timePenalty;

        // Always allow 3 mistakes - scrambling is punishment enough
        this.maxMistakes = 3;
    }

    // Process a key press
    processKey(key, drunkLevel = 0) {
        if (!this.isActive || this.success || this.failed) return;

        const expectedKey = this.sequence[this.currentIndex];
        const now = performance.now();

        if (key === expectedKey) {
            this.currentIndex++;
            this.keyFeedback = { key, success: true, time: now };

            if (this.currentIndex >= this.sequence.length) {
                this.success = true;
                this.isActive = false;
            }
        } else {
            this.mistakes++;
            this.keyFeedback = { key, success: false, time: now };

            this.timeRemaining -= 500;

            if (this.mistakes >= this.maxMistakes) {
                this.failed = true;
                this.isActive = false;
            }
        }

        this.lastKeyTime = now;
    }

    update(deltaTime) {
        if (!this.isActive) return;

        this.timeRemaining -= deltaTime;

        if (this.timeRemaining <= 0) {
            this.failed = true;
            this.isActive = false;
        }

        if (this.keyFeedback && performance.now() - this.keyFeedback.time > 200) {
            this.keyFeedback = null;
        }
    }

    getDisplayInfo() {
        return {
            sequence: this.sequence,
            currentIndex: this.currentIndex,
            timeRemaining: this.timeRemaining,
            timeMax: GAME_CONFIG.STUFFING_TIME_LIMIT,
            mistakes: this.mistakes,
            maxMistakes: this.maxMistakes,
            isActive: this.isActive,
            success: this.success,
            failed: this.failed,
            keyFeedback: this.keyFeedback
        };
    }

    isComplete() {
        return this.success || this.failed;
    }

    wasSuccessful() {
        return this.success;
    }
}
