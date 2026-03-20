// Difficulty System - Manages progressive difficulty for Gaming mode
// Supports infinite scaling beyond predefined levels

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
        // First check predefined levels
        let foundLevel = 1;
        for (let i = DIFFICULTY_LEVELS.length - 1; i >= 0; i--) {
            if (timeAlive >= DIFFICULTY_LEVELS[i].timeThreshold) {
                foundLevel = DIFFICULTY_LEVELS[i].level;
                break;
            }
        }

        // Beyond predefined levels: every 30 seconds adds a new level
        const lastPredefined = DIFFICULTY_LEVELS[DIFFICULTY_LEVELS.length - 1];
        if (timeAlive >= lastPredefined.timeThreshold) {
            const extraTime = timeAlive - lastPredefined.timeThreshold;
            const extraLevels = Math.floor(extraTime / 30); // New level every 30 seconds
            foundLevel = lastPredefined.level + extraLevels;
        }

        this.currentLevel = foundLevel;

        // Check if level just changed
        this.levelJustChanged = this.currentLevel !== this.previousLevel;
    }

    getLevelConfig() {
        if (this.gameMode !== GAME_MODES.GAMING) {
            return DIFFICULTY_LEVELS[0]; // Base difficulty for Hartz IV
        }

        // Use predefined level if available
        if (this.currentLevel <= DIFFICULTY_LEVELS.length) {
            return DIFFICULTY_LEVELS[this.currentLevel - 1];
        }

        // Generate dynamic config for levels beyond predefined
        const lastPredefined = DIFFICULTY_LEVELS[DIFFICULTY_LEVELS.length - 1];
        const extraLevels = this.currentLevel - DIFFICULTY_LEVELS.length;

        // Exponential scaling that eventually becomes impossible
        // Each extra level increases difficulty significantly
        const scaleFactor = Math.pow(1.15, extraLevels); // 15% harder per level

        return {
            level: this.currentLevel,
            name: this.currentLevel + 'th',
            timeThreshold: lastPredefined.timeThreshold + (extraLevels * 30),
            // Multiplier keeps growing - meters fill faster and faster
            multiplier: lastPredefined.multiplier * scaleFactor,
            // Tempo caps at 2.0x to remain somewhat audible
            tempo: Math.min(2.0, lastPredefined.tempo * Math.pow(1.05, extraLevels)),
            // Stuffing time keeps shrinking (min 0.3 = 30% of original, ~2.4 seconds)
            stuffingTime: Math.max(0.3, lastPredefined.stuffingTime * Math.pow(0.9, extraLevels)),
            // Keys cap at 8 to fit on screen
            stuffingKeys: Math.min(8, lastPredefined.stuffingKeys + Math.floor(extraLevels / 3))
        };
    }

    getLevel() {
        return this.currentLevel;
    }

    getLevelName() {
        const config = this.getLevelConfig();
        return config.name;
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
        // Score multiplier increases with level (no cap - reward skilled players)
        return 1 + (this.currentLevel - 1) * 0.5;
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

    // Get intensity value for visual effects (caps at 1.0 for visuals)
    getIntensity() {
        if (this.gameMode !== GAME_MODES.GAMING) {
            return 0;
        }
        // Cap at 1.0 for visual effects, but let difficulty keep scaling
        return Math.min(1.0, (this.currentLevel - 1) / 4);
    }

    // Get raw intensity (uncapped) for things that should keep scaling
    getRawIntensity() {
        if (this.gameMode !== GAME_MODES.GAMING) {
            return 0;
        }
        return (this.currentLevel - 1) / 4;
    }
}
