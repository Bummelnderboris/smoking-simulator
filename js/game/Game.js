import { GAME_CONFIG, GAME_STATES, DEATH_CAUSES, KEYS } from '../utils/constants.js';
import { Player } from './Player.js';
import { InputHandler } from './InputHandler.js';
import { StuffingSystem } from '../systems/StuffingSystem.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { AchievementSystem } from '../systems/AchievementSystem.js';
import { LeaderboardSystem } from '../systems/LeaderboardSystem.js';
import { DayNightSystem } from '../systems/DayNightSystem.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.state = GAME_STATES.MENU;
        this.deathCause = '';

        // Systems
        this.player = new Player();
        this.input = new InputHandler();
        this.stuffing = new StuffingSystem();
        this.renderer = new RenderSystem(canvas);
        this.audio = new AudioSystem();
        this.achievements = new AchievementSystem();
        this.leaderboard = new LeaderboardSystem();
        this.dayNight = new DayNightSystem();

        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;

        // Warning timers
        this.lastOxygenWarning = 0;
        this.lastDrowsinessWarning = 0;
        this.warningCooldown = 1000;

        // High scores
        this.highScore = this.loadHighScore();
        this.isNewHighScore = false;

        // Stuffing tracking
        this.stuffingStartTime = 0;

        // Drunk effects
        this.lastInversionCheck = 0;
        this.inversionCooldown = 10000; // 10 seconds between inversions

        // Menu state
        this.showLeaderboard = false;
        this.showAchievements = false;

        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
    }

    async init() {
        await this.audio.init();
        console.log('Game initialized');
        console.log(`High score: ${this.highScore}`);
        console.log(`Achievements: ${this.achievements.getUnlockedCount()}/${this.achievements.getTotalCount()}`);
    }

    loadHighScore() {
        try {
            const saved = localStorage.getItem('smokingSimHighScore');
            return saved ? parseInt(saved, 10) : 0;
        } catch (e) {
            return 0;
        }
    }

    saveHighScore(score) {
        try {
            localStorage.setItem('smokingSimHighScore', Math.floor(score).toString());
            this.highScore = Math.floor(score);
        } catch (e) {
            console.warn('Could not save high score');
        }
    }

    start() {
        this.lastTime = performance.now();
        requestAnimationFrame(this.gameLoop);
    }

    gameLoop(currentTime) {
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Cap delta time to avoid huge jumps
        this.deltaTime = Math.min(this.deltaTime, 100);

        this.update(this.deltaTime);
        this.render();

        this.input.clearJustPressed();
        requestAnimationFrame(this.gameLoop);
    }

    update(deltaTime) {
        this.renderer.update(deltaTime);
        this.input.setDrunkLevel(this.player.getDrunkLevel());

        switch (this.state) {
            case GAME_STATES.MENU:
                this.updateMenu();
                break;
            case GAME_STATES.PLAYING:
                this.updatePlaying(deltaTime);
                break;
            case GAME_STATES.STUFFING:
                this.updateStuffing(deltaTime);
                break;
            case GAME_STATES.GAME_OVER:
                this.updateGameOver();
                break;
        }
    }

    updateMenu() {
        if (this.input.isJustPressed(KEYS.START) || this.input.isJustPressed('enter')) {
            this.startGame();
        }
    }

    async startGame() {
        this.player.reset();
        this.stuffing.reset();
        this.achievements.resetSession();
        this.dayNight = new DayNightSystem();
        this.state = GAME_STATES.PLAYING;
        this.deathCause = '';
        this.showLeaderboard = false;
        this.showAchievements = false;

        await this.audio.resume();
        this.audio.startMusic();
    }

    updatePlaying(deltaTime) {
        // Check for hiccup before updating (for visual effect)
        const wasHiccuping = this.player.isHiccuping;

        // Update player
        this.player.update(deltaTime);

        // Update day/night cycle
        this.dayNight.update(this.player.timeAlive);

        // Update audio drunk effects
        this.audio.setDrunkLevel(this.player.drunkenness);

        // Update achievements
        this.achievements.update(this.player, deltaTime);

        // Check for achievement notifications
        if (this.achievements.hasNotifications()) {
            const notification = this.achievements.getNextNotification();
            if (notification) {
                this.renderer.showNotification(notification);
                this.audio.playStuffSuccessSound(); // Use as achievement sound
            }
        }

        // Drunk effect: Random control inversion at 80%+
        const now = performance.now();
        if (this.player.drunkenness >= 80 && now - this.lastInversionCheck > this.inversionCooldown) {
            this.lastInversionCheck = now;
            if (Math.random() < 0.3) { // 30% chance
                this.renderer.triggerControlInversion(2000);
                this.audio.playWarningBeep();
            }
        }

        // Hiccup just started
        if (this.player.isHiccuping && !wasHiccuping) {
            this.audio.playHiccupSound();
            this.renderer.addShake(5);
        }

        // Handle smoking (blocked during hiccup)
        // Check for inverted controls
        const smokeKey = this.renderer.isControlsInverted() ? KEYS.DRINK : KEYS.SMOKE;
        const drinkKey = this.renderer.isControlsInverted() ? KEYS.SMOKE : KEYS.DRINK;

        if (!this.player.isHiccuping) {
            if (this.input.isJustPressed(smokeKey) || this.input.isHeld(smokeKey)) {
                if (this.player.smoke()) {
                    this.audio.playSmokeSound();
                    this.achievements.onSmoke(this.player);

                    // Add smoke particles
                    for (let i = 0; i < 5; i++) {
                        this.renderer.addSmokeParticle(500, 380);
                    }
                }
            }
        }

        // Handle drinking
        if (this.input.isJustPressed(drinkKey)) {
            if (this.player.drink()) {
                this.audio.playDrinkSound();
                this.achievements.onDrink();
            }
        }

        // Handle starting to stuff (any WASD key)
        const stuffKey = this.input.getStuffingKeyPressed();
        if (stuffKey && this.player.queuedCigarettes < GAME_CONFIG.MAX_QUEUED_CIGARETTES) {
            this.startStuffing();
        }

        // Check warnings
        this.checkWarnings();

        // Check death
        const death = this.player.checkDeath();
        if (death) {
            this.gameOver(death);
        }
    }

    startStuffing() {
        this.state = GAME_STATES.STUFFING;
        this.stuffing.start(this.player.drunkenness);
        this.stuffingStartTime = performance.now();
    }

    updateStuffing(deltaTime) {
        this.stuffing.update(deltaTime);

        // Player still takes damage while stuffing!
        this.player.update(deltaTime);

        // Continue day/night cycle
        this.dayNight.update(this.player.timeAlive);

        // Continue achievement tracking
        this.achievements.update(this.player, deltaTime);

        // Handle key presses
        const keyPressed = this.input.getStuffingKeyPressed();
        if (keyPressed) {
            // Maybe scramble the key if drunk
            const actualKey = this.input.getScrambledKey(keyPressed);
            this.stuffing.processKey(actualKey, this.player.drunkenness);

            // Play feedback sound
            const info = this.stuffing.getDisplayInfo();
            if (info.keyFeedback) {
                this.audio.playKeyPressSound(info.keyFeedback.success);
            }
        }

        // Check if stuffing is complete
        if (this.stuffing.isComplete()) {
            const stuffDuration = performance.now() - this.stuffingStartTime;

            if (this.stuffing.wasSuccessful()) {
                this.player.addCigarette();
                this.audio.playStuffSuccessSound();
                this.achievements.onStuffSuccess(stuffDuration);
            } else {
                this.audio.playStuffFailSound();
                this.renderer.addShake(10);
                this.achievements.onStuffFail();
            }

            this.state = GAME_STATES.PLAYING;
            this.stuffing.reset();
        }

        // Still allow emergency smoke
        if (this.input.isJustPressed(KEYS.SMOKE)) {
            if (this.player.smoke()) {
                this.audio.playSmokeSound();
            }
        }

        // Check death during stuffing
        const death = this.player.checkDeath();
        if (death) {
            this.gameOver(death);
        }
    }

    checkWarnings() {
        const now = performance.now();

        if (this.player.oxygen >= GAME_CONFIG.OXYGEN_DANGER_THRESHOLD) {
            if (now - this.lastOxygenWarning > this.warningCooldown) {
                this.audio.playWarningBeep();
                this.renderer.addShake(3);
                this.lastOxygenWarning = now;
            }
        }

        if (this.player.drowsiness >= GAME_CONFIG.DROWSINESS_DANGER_THRESHOLD) {
            if (now - this.lastDrowsinessWarning > this.warningCooldown) {
                this.audio.playWarningBeep();
                this.lastDrowsinessWarning = now;
            }
        }
    }

    gameOver(cause) {
        this.state = GAME_STATES.GAME_OVER;
        this.deathCause = DEATH_CAUSES[cause] || 'You died somehow.';
        this.audio.stopMusic();
        this.audio.playGameOverSound();
        this.renderer.addShake(15);

        // Process achievements
        this.achievements.onGameOver(this.player);

        // Submit to leaderboard
        this.playerRank = this.leaderboard.submitScore(
            this.player.score,
            this.player.timeAlive,
            this.player.totalCigarettesSmoked
        );

        // Check for new high score
        if (this.player.score > this.highScore) {
            this.isNewHighScore = true;
            this.saveHighScore(this.player.score);
        } else {
            this.isNewHighScore = false;
        }

        // Show leaderboard on game over
        this.showLeaderboard = true;
    }

    updateGameOver() {
        if (this.input.isJustPressed(KEYS.START) || this.input.isJustPressed('enter')) {
            this.state = GAME_STATES.MENU;
        }
    }

    render() {
        this.renderer.clear();

        switch (this.state) {
            case GAME_STATES.MENU:
                this.renderer.drawMenu(this.highScore);
                // Show achievements in menu if toggled (press A)
                if (this.input.isJustPressed('a')) {
                    this.showAchievements = !this.showAchievements;
                    this.showLeaderboard = false;
                }
                if (this.input.isJustPressed('l')) {
                    this.showLeaderboard = !this.showLeaderboard;
                    this.showAchievements = false;
                }
                if (this.showAchievements) {
                    this.renderer.drawAchievements(this.achievements.getAllAchievements());
                }
                if (this.showLeaderboard) {
                    this.renderer.drawLeaderboard(this.leaderboard.getTopEntries());
                }
                break;

            case GAME_STATES.PLAYING:
            case GAME_STATES.STUFFING:
                this.renderGame();
                if (this.state === GAME_STATES.STUFFING) {
                    this.renderer.drawStuffingUI(
                        this.stuffing.getDisplayInfo(),
                        this.player.drunkenness
                    );
                }
                break;

            case GAME_STATES.GAME_OVER:
                this.renderGame();
                this.renderer.drawGameOver(this.player, this.deathCause, this.highScore, this.isNewHighScore);
                // Show leaderboard on game over
                if (this.showLeaderboard) {
                    this.renderer.drawLeaderboard(this.leaderboard.getTopEntries(), this.playerRank);
                }
                break;
        }
    }

    renderGame() {
        // Get day/night colors and stars
        const dayNightColors = this.dayNight.getCurrentColors();
        const stars = this.dayNight.shouldShowStars() ? this.dayNight.getStars() : [];

        // Apply drunk/shake effects
        this.renderer.applyScreenEffects(this.player.drunkenness);

        // Draw scene with day/night cycle
        this.renderer.drawTable(dayNightColors, stars);

        // Draw ashtray with queued cigarettes
        this.renderer.drawAshtray(300, 450, this.player.queuedCigarettes);

        // Draw beer glass
        const beerLevel = 1 - (this.player.totalBeersConsumed % 1);
        this.renderer.drawBeerGlass(550, 440, beerLevel);

        // Draw current cigarette if player has one
        if (this.player.hasLitCigarette) {
            this.renderer.drawCurrentCigarette(
                480, 380,
                this.player.currentCigarette,
                this.player.isSmoking,
                this.player.drunkenness
            );
        }

        // Draw smoke particles
        this.renderer.drawSmoke();

        // Apply enhanced drunk effects (double vision, color shift)
        this.renderer.applyDrunkEffects(this.player.drunkenness);

        // Reset screen effects before UI
        this.renderer.resetScreenEffects();

        // Draw HUD (not affected by drunk wobble)
        this.renderer.drawHUD(this.player);

        // Draw time of day indicator
        this.renderer.drawTimeIndicator(this.dayNight.getPhaseDisplayName());

        // Draw inverted controls warning if active
        this.renderer.drawInvertedWarning();

        // Draw achievement notification if any
        this.renderer.drawAchievementNotification();

        // CRT effect on top
        this.renderer.drawCRTEffect();
    }
}
