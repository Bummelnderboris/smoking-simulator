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
    start(drunkLevel = 0, isGamingMode = false, difficultyConfig = null) {
        this.reset();
        this.isActive = true;

        let length, timeLimit;

        if (isGamingMode && difficultyConfig) {
            // Gaming mode: Difficulty scales with level, not drunk
            length = difficultyConfig.stuffingKeys;
            // Time scales down with difficulty
            timeLimit = GAME_CONFIG.STUFFING_TIME_LIMIT * difficultyConfig.stuffingTime;
        } else {
            // Hartz IV mode: Scales with drunk level (original behavior)
            const extraKeys = Math.floor(drunkLevel / 50);
            length = Math.min(6, GAME_CONFIG.STUFFING_SEQUENCE_LENGTH + extraKeys);
            // Adjust time - gentler penalty (max 1.5 second reduction)
            const timePenalty = Math.min(1500, drunkLevel * 15);
            timeLimit = GAME_CONFIG.STUFFING_TIME_LIMIT - timePenalty;
        }

        // Generate random sequence
        this.sequence = [];
        for (let i = 0; i < length; i++) {
            this.sequence.push(randomChoice(KEYS.STUFF_KEYS));
        }

        this.timeRemaining = timeLimit;

        // Always allow 3 mistakes
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
