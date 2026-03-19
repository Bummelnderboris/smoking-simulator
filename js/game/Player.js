import { GAME_CONFIG } from '../utils/constants.js';
import { clamp } from '../utils/helpers.js';

export class Player {
    constructor() {
        this.reset();
    }

    reset() {
        // Meters
        this.oxygen = 0;           // 0 = good, 100 = death by fresh air
        this.drowsiness = 0;       // 0 = alert, 100 = passed out
        this.drunkenness = 0;      // 0 = sober, 100 = wasted

        // Cigarettes
        this.queuedCigarettes = GAME_CONFIG.STARTING_CIGARETTES;
        this.currentCigarette = GAME_CONFIG.CIGARETTE_CAPACITY;
        this.hasLitCigarette = true;
        this.totalCigarettesSmoked = 0;

        // Beer
        this.totalBeersConsumed = 0;
        this.sipCooldown = 0;

        // Stats
        this.score = 0;
        this.timeAlive = 0;

        // State
        this.isStuffing = false;
        this.isSmoking = false;
        this.isDrinking = false;
        this.smokeCooldown = 0;

        // Hiccup system
        this.isHiccuping = false;
        this.hiccupTimer = 0;
        this.hiccupCooldown = 0;
        this.lastHiccup = 0;
    }

    update(deltaTime) {
        const dt = deltaTime / 1000;

        // Cooldowns
        if (this.smokeCooldown > 0) {
            this.smokeCooldown -= deltaTime;
        }
        if (this.sipCooldown > 0) {
            this.sipCooldown -= deltaTime;
        }

        // Oxygen fills if not smoking
        if (!this.isSmoking) {
            this.oxygen += GAME_CONFIG.OXYGEN_FILL_RATE * dt;
        }

        // Drowsiness increases over time
        this.drowsiness += GAME_CONFIG.DROWSINESS_FILL_RATE * dt;

        // Drunkenness slowly decays
        if (this.drunkenness > 0) {
            this.drunkenness -= GAME_CONFIG.DRUNKENNESS_DECAY_RATE * dt;
        }

        // Clamp values
        this.oxygen = clamp(this.oxygen, 0, GAME_CONFIG.OXYGEN_MAX);
        this.drowsiness = clamp(this.drowsiness, 0, GAME_CONFIG.DROWSINESS_MAX);
        this.drunkenness = clamp(this.drunkenness, 0, GAME_CONFIG.DRUNKENNESS_MAX);

        // Update stats
        this.timeAlive += dt;
        this.score += GAME_CONFIG.POINTS_PER_SECOND * dt;

        // Hiccup system
        if (this.hiccupCooldown > 0) {
            this.hiccupCooldown -= deltaTime;
        }
        if (this.hiccupTimer > 0) {
            this.hiccupTimer -= deltaTime;
            this.isHiccuping = this.hiccupTimer > 0;
        }

        // Random chance to hiccup based on drunk level
        if (this.drunkenness >= 40 && this.hiccupCooldown <= 0 && !this.isHiccuping) {
            const hiccupChance = (this.drunkenness - 40) / 6000;
            if (Math.random() < hiccupChance) {
                this.triggerHiccup();
            }
        }

        // Reset smoking state
        this.isSmoking = false;
        this.isDrinking = false;
    }

    triggerHiccup() {
        this.isHiccuping = true;
        this.hiccupTimer = 300;
        this.hiccupCooldown = 2000 + Math.random() * 3000;
        this.lastHiccup = performance.now();
        return true;
    }

    smoke() {
        if (this.smokeCooldown > 0) return false;
        if (!this.hasLitCigarette) return false;

        this.oxygen -= GAME_CONFIG.OXYGEN_DRAIN_RATE;
        this.oxygen = Math.max(0, this.oxygen);

        this.currentCigarette -= GAME_CONFIG.SMOKE_CONSUMPTION;
        this.isSmoking = true;
        this.smokeCooldown = 150;

        if (this.currentCigarette <= 0) {
            this.finishCigarette();
        }

        return true;
    }

    finishCigarette() {
        this.totalCigarettesSmoked++;
        this.score += GAME_CONFIG.POINTS_PER_CIGARETTE;
        this.hasLitCigarette = false;
        this.currentCigarette = 0;

        if (this.queuedCigarettes > 0) {
            this.lightNextCigarette();
        }
    }

    lightNextCigarette() {
        if (this.queuedCigarettes <= 0) return false;

        this.queuedCigarettes--;
        this.currentCigarette = GAME_CONFIG.CIGARETTE_CAPACITY;
        this.hasLitCigarette = true;
        return true;
    }

    addCigarette() {
        if (this.queuedCigarettes >= GAME_CONFIG.MAX_QUEUED_CIGARETTES) {
            return false;
        }
        this.queuedCigarettes++;
        return true;
    }

    drink() {
        if (this.sipCooldown > 0) return false;

        this.drowsiness -= GAME_CONFIG.DROWSINESS_DRAIN_PER_SIP;
        this.drowsiness = Math.max(0, this.drowsiness);

        this.drunkenness += GAME_CONFIG.DRUNKENNESS_PER_SIP;

        this.totalBeersConsumed += 0.2;
        this.score += GAME_CONFIG.POINTS_PER_BEER * 0.2;

        this.isDrinking = true;
        this.sipCooldown = 300;

        return true;
    }

    checkDeath() {
        if (this.oxygen >= GAME_CONFIG.OXYGEN_MAX) {
            return 'OXYGEN';
        }
        if (this.drowsiness >= GAME_CONFIG.DROWSINESS_MAX) {
            return 'DROWSINESS';
        }
        if (!this.hasLitCigarette && this.queuedCigarettes <= 0) {
            return 'NO_CIGARETTES';
        }
        return null;
    }

    getDrunkLevel() {
        if (this.drunkenness >= GAME_CONFIG.DRUNK_LEVEL_3) return 3;
        if (this.drunkenness >= GAME_CONFIG.DRUNK_LEVEL_2) return 2;
        if (this.drunkenness >= GAME_CONFIG.DRUNK_LEVEL_1) return 1;
        return 0;
    }

    getInputDelay() {
        return GAME_CONFIG.INPUT_DELAY_BASE +
               this.drunkenness * GAME_CONFIG.INPUT_DELAY_DRUNK_MULT;
    }
}
