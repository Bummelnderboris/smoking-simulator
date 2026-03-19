// Difficulty System - Manages progressive difficulty for Gaming mode

import { DIFFICULTY_LEVELS, GAME_MODES } from '../utils/constants.js';

export class DifficultySystem {
    constructor() {
        this.currentLevel = 1;
        this.previousLevel = 1;
        this.gameMode = GAME_MODES.HARTZ_IV;
        this.levelJustChanged = false;
    }

    reset(gameMode = GAME_MODES.HARTZ_IV) {
        this.currentLevel = 1;
        this.previousLevel = 1;
        this.gameMode = gameMode;
        this.levelJustChanged = false;
    }

    update(timeAlive) {
        if (this.gameMode !== GAME_MODES.GAMING) {
            return; // No progression in Hartz IV mode
        }

        this.previousLevel = this.currentLevel;

        // Find current level based on time
        for (let i = DIFFICULTY_LEVELS.length - 1; i >= 0; i--) {
            if (timeAlive >= DIFFICULTY_LEVELS[i].timeThreshold) {
                this.currentLevel = DIFFICULTY_LEVELS[i].level;
                break;
            }
        }

        // Check if level just changed
        this.levelJustChanged = this.currentLevel !== this.previousLevel;
    }

    getLevelConfig() {
        if (this.gameMode !== GAME_MODES.GAMING) {
            return DIFFICULTY_LEVELS[0]; // Base difficulty for Hartz IV
        }
        return DIFFICULTY_LEVELS[this.currentLevel - 1] || DIFFICULTY_LEVELS[0];
    }

    getLevel() {
        return this.currentLevel;
    }

    getLevelName() {
        return this.getLevelConfig().name;
    }

    getMultiplier() {
        if (this.gameMode !== GAME_MODES.GAMING) {
            return 1.0;
        }
        return this.getLevelConfig().multiplier;
    }

    getMusicTempo() {
        if (this.gameMode !== GAME_MODES.GAMING) {
            return 1.0;
        }
        return this.getLevelConfig().tempo;
    }

    getStuffingTimeMultiplier() {
        if (this.gameMode !== GAME_MODES.GAMING) {
            return 1.0;
        }
        return this.getLevelConfig().stuffingTime;
    }

    getStuffingKeyCount() {
        if (this.gameMode !== GAME_MODES.GAMING) {
            return null; // Use drunk-based calculation in Hartz IV
        }
        return this.getLevelConfig().stuffingKeys;
    }

    getScoreMultiplier() {
        if (this.gameMode !== GAME_MODES.GAMING) {
            return 1.0;
        }
        // Score multiplier increases with level
        return 1 + (this.currentLevel - 1) * 0.5; // 1x, 1.5x, 2x, 2.5x, 3x
    }

    didLevelUp() {
        const result = this.levelJustChanged && this.currentLevel > this.previousLevel;
        return result;
    }

    clearLevelUpFlag() {
        this.levelJustChanged = false;
    }

    isGamingMode() {
        return this.gameMode === GAME_MODES.GAMING;
    }

    // Get intensity value 0-1 based on current level (for visual effects)
    getIntensity() {
        if (this.gameMode !== GAME_MODES.GAMING) {
            return 0;
        }
        return (this.currentLevel - 1) / (DIFFICULTY_LEVELS.length - 1);
    }
}
