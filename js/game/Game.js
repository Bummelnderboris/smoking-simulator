import { GAME_CONFIG, GAME_STATES, GAME_MODES, DEATH_CAUSES, KEYS } from '../utils/constants.js';
import { Player } from './Player.js';
import { InputHandler } from './InputHandler.js';
import { StuffingSystem } from '../systems/StuffingSystem.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { AchievementSystem } from '../systems/AchievementSystem.js';
import { LeaderboardSystem } from '../systems/LeaderboardSystem.js';
import { DayNightSystem } from '../systems/DayNightSystem.js';
import { DifficultySystem } from '../systems/DifficultySystem.js';

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
        this.difficulty = new DifficultySystem();

        // Game mode
        this.gameMode = GAME_MODES.HARTZ_IV;

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

        // Name entry state
        this.enteredName = '';
        this.nameCursorBlink = 0;

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
            case GAME_STATES.MODE_SELECT:
                this.updateModeSelect();
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
            case GAME_STATES.NAME_ENTRY:
                this.updateNameEntry(deltaTime);
                break;
        }
    }

    updateMenu() {
        if (this.input.isJustPressed(KEYS.START) || this.input.isJustPressed('enter')) {
            this.state = GAME_STATES.MODE_SELECT;
        }
    }

    updateModeSelect() {
        // H for Hartz IV mode
        if (this.input.isJustPressed('h')) {
            this.gameMode = GAME_MODES.HARTZ_IV;
            this.startGame();
        }
        // G for Gaming mode
        if (this.input.isJustPressed('g')) {
            this.gameMode = GAME_MODES.GAMING;
            this.startGame();
        }
        // Escape to go back to menu
        if (this.input.isJustPressed('escape')) {
            this.state = GAME_STATES.MENU;
        }
    }

    async startGame() {
        this.player.reset();
        this.stuffing.reset();
        this.achievements.resetSession();
        this.dayNight = new DayNightSystem();
        this.difficulty.reset(this.gameMode);
        this.state = GAME_STATES.PLAYING;
        this.deathCause = '';

        // Reset all UI state flags
        this.showLeaderboard = false;
        this.showAchievements = false;
        this.isNewHighScore = false;
        this.playerRank = null;
        this.enteredName = '';

        // Reset drunk effect tracking
        this.lastInversionCheck = 0;

        await this.audio.resume();
        this.audio.startMusic();
        this.audio.setTempo(1.0); // Reset tempo
    }

    updatePlaying(deltaTime) {
        // Check for hiccup before updating (for visual effect)
        const wasHiccuping = this.player.isHiccuping;

        // Update difficulty system (Gaming mode progression)
        this.difficulty.update(this.player.timeAlive);

        // Check for level-up in Gaming mode
        if (this.difficulty.didLevelUp()) {
            this.audio.playLevelUpSound();
            this.renderer.triggerLevelUpFlash();
            this.renderer.addShake(8);
            // Update music tempo
            this.audio.setTempo(this.difficulty.getMusicTempo());
            this.difficulty.clearLevelUpFlag();
        }

        // Update player with difficulty multiplier
        const difficultyMult = this.difficulty.getMultiplier();
        this.player.update(deltaTime, difficultyMult, this.difficulty.isGamingMode());

        // Update day/night cycle
        this.dayNight.update(this.player.timeAlive);

        // Update audio drunk effects (only cosmetic in Gaming mode)
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

        // Drunk effect: Random control inversion at 80%+ (Hartz IV mode only)
        // Only trigger if not already inverted to prevent stacking
        const now = performance.now();
        if (!this.difficulty.isGamingMode() &&
            this.player.drunkenness >= 80 &&
            now - this.lastInversionCheck > this.inversionCooldown &&
            !this.renderer.isControlsInverted()) {
            this.lastInversionCheck = now;
            if (Math.random() < 0.3) { // 30% chance
                this.renderer.triggerControlInversion(2000);
                this.audio.playWarningBeep();
            }
        }

        // Hiccup just started (Hartz IV mode only - cosmetic in Gaming)
        if (this.player.isHiccuping && !wasHiccuping) {
            this.audio.playHiccupSound();
            if (!this.difficulty.isGamingMode()) {
                this.renderer.addShake(5);
            }
        }

        // Handle smoking (blocked during hiccup in Hartz IV mode only)
        // Control inversion only in Hartz IV mode
        const isGaming = this.difficulty.isGamingMode();
        const smokeKey = (!isGaming && this.renderer.isControlsInverted()) ? KEYS.DRINK : KEYS.SMOKE;
        const drinkKey = (!isGaming && this.renderer.isControlsInverted()) ? KEYS.SMOKE : KEYS.DRINK;

        // In Gaming mode, hiccups don't block actions
        const canAct = isGaming || !this.player.isHiccuping;

        if (canAct) {
            if (this.input.isJustPressed(smokeKey) || this.input.isHeld(smokeKey)) {
                if (this.player.smoke()) {
                    this.audio.playSmokeSound();
                    this.achievements.onSmoke(this.player);

                    // Add smoke particles (new position for ego perspective)
                    for (let i = 0; i < 5; i++) {
                        this.renderer.addSmokeParticle(430, 390);
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
        // Check capacity FIRST to avoid consuming key press when at max capacity
        if (this.player.queuedCigarettes < GAME_CONFIG.MAX_QUEUED_CIGARETTES) {
            const stuffKey = this.input.getStuffingKeyPressed();
            if (stuffKey) {
                this.startStuffing();
            }
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
        this.stuffing.start(
            this.player.drunkenness,
            this.difficulty.isGamingMode(),
            this.difficulty.getLevelConfig()
        );
        this.stuffingStartTime = performance.now();
    }

    updateStuffing(deltaTime) {
        this.stuffing.update(deltaTime);

        // Player still takes damage while stuffing!
        const difficultyMult = this.difficulty.getMultiplier();
        this.player.update(deltaTime, difficultyMult, this.difficulty.isGamingMode());

        // Continue day/night cycle
        this.dayNight.update(this.player.timeAlive);

        // Continue achievement tracking
        this.achievements.update(this.player, deltaTime);

        // Handle key presses
        const keyPressed = this.input.getStuffingKeyPressed();
        if (keyPressed) {
            // Only scramble keys in Hartz IV mode (no RNG in Gaming mode)
            const actualKey = this.difficulty.isGamingMode()
                ? keyPressed
                : this.input.getScrambledKey(keyPressed);
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
        this.deathCause = DEATH_CAUSES[cause] || 'You died somehow.';
        this.audio.stopMusic();
        this.audio.playGameOverSound();
        this.renderer.addShake(15);

        // Process achievements
        this.achievements.onGameOver(this.player);

        // Check for new high score
        if (this.player.score > this.highScore) {
            this.isNewHighScore = true;
            this.saveHighScore(this.player.score);
        } else {
            this.isNewHighScore = false;
        }

        // Check if score qualifies for leaderboard
        if (this.leaderboard.isOnLeaderboard(this.player.score)) {
            // Go to name entry first
            this.state = GAME_STATES.NAME_ENTRY;
            this.enteredName = this.leaderboard.getPlayerName();
            this.nameCursorBlink = 0;
        } else {
            // Go directly to game over
            this.state = GAME_STATES.GAME_OVER;
            this.playerRank = null;
            this.showLeaderboard = false;
        }
    }

    updateNameEntry(deltaTime) {
        // Cursor blink
        this.nameCursorBlink += deltaTime;

        // Handle typed characters
        const typedChar = this.input.getTypedCharacter();
        if (typedChar && this.enteredName.length < 12) {
            // Only allow alphanumeric characters
            if (/^[a-zA-Z0-9]$/.test(typedChar)) {
                this.enteredName += typedChar.toUpperCase();
            }
        }

        // Handle backspace
        if (this.input.isJustPressed('backspace') && this.enteredName.length > 0) {
            this.enteredName = this.enteredName.slice(0, -1);
        }

        // Handle enter to confirm
        if (this.input.isJustPressed('enter') || this.input.isJustPressed(KEYS.START)) {
            if (this.enteredName.length > 0) {
                // Save name and submit score
                this.leaderboard.setPlayerName(this.enteredName);
                this.playerRank = this.leaderboard.submitScore(
                    this.player.score,
                    this.player.timeAlive,
                    this.player.totalCigarettesSmoked
                );
                this.state = GAME_STATES.GAME_OVER;
                this.showLeaderboard = true;
            }
        }
    }

    updateGameOver() {
        // Toggle leaderboard with L
        if (this.input.isJustPressed('l')) {
            this.showLeaderboard = !this.showLeaderboard;
        }

        if (this.input.isJustPressed(KEYS.START) || this.input.isJustPressed('enter')) {
            this.state = GAME_STATES.MENU;
            this.showLeaderboard = false;
            this.showAchievements = false;
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

            case GAME_STATES.MODE_SELECT:
                this.renderer.drawModeSelect();
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

            case GAME_STATES.NAME_ENTRY:
                this.renderGame();
                const cursorVisible = Math.floor(this.nameCursorBlink / 400) % 2 === 0;
                this.renderer.drawNameEntry(
                    this.enteredName,
                    cursorVisible,
                    this.player.score,
                    this.isNewHighScore
                );
                break;

            case GAME_STATES.GAME_OVER:
                this.renderGame();
                if (this.showLeaderboard) {
                    // Draw leaderboard as full screen overlay (not on top of game over)
                    this.renderer.drawLeaderboardFullScreen(
                        this.leaderboard.getTopEntries(),
                        this.playerRank
                    );
                } else {
                    this.renderer.drawGameOver(this.player, this.deathCause, this.highScore, this.isNewHighScore);
                }
                break;
        }
    }

    renderGame() {
        // Get day/night colors and stars
        const dayNightColors = this.dayNight.getCurrentColors();
        const stars = this.dayNight.shouldShowStars() ? this.dayNight.getStars() : [];

        // Pass drunk level to renderer for belly sizing
        this.renderer.setDrunkLevel(this.player.drunkenness);

        // Apply drunk/shake effects
        this.renderer.applyScreenEffects(this.player.drunkenness);

        // Draw scene with day/night cycle (room, table, belly)
        this.renderer.drawTable(dayNightColors, stars);

        // Draw ashtray with queued cigarettes (repositioned for perspective table)
        this.renderer.drawAshtray(280, 360, this.player.queuedCigarettes);

        // Draw beer glass (repositioned)
        const beerLevel = 1 - (this.player.totalBeersConsumed % 1);
        this.renderer.drawBeerGlass(520, 380, beerLevel);

        // Draw current cigarette if player has one (closer to player, in front)
        if (this.player.hasLitCigarette) {
            this.renderer.drawCurrentCigarette(
                400, 400,
                this.player.currentCigarette,
                this.player.isSmoking,
                this.player.drunkenness
            );
        }

        // Draw smoke particles
        this.renderer.drawSmoke();

        // Apply enhanced drunk effects (double vision, color shift)
        this.renderer.applyDrunkEffects(this.player.drunkenness);

        // Gaming mode: Draw speed lines based on intensity
        if (this.difficulty.isGamingMode()) {
            this.renderer.drawSpeedLines(this.difficulty.getIntensity());
        }

        // Reset screen effects before UI
        this.renderer.resetScreenEffects();

        // Draw HUD (not affected by drunk wobble)
        // Pass difficulty info for Gaming mode display
        this.renderer.drawHUD(this.player, this.difficulty);

        // Draw time of day indicator
        this.renderer.drawTimeIndicator(this.dayNight.getPhaseDisplayName());

        // Draw inverted controls warning if active (Hartz IV only)
        if (!this.difficulty.isGamingMode()) {
            this.renderer.drawInvertedWarning();
        }

        // Draw achievement notification if any
        this.renderer.drawAchievementNotification();

        // Draw level-up flash if active
        this.renderer.drawLevelUpFlash();

        // CRT effect on top
        this.renderer.drawCRTEffect();
    }
}
