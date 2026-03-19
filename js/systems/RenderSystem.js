import { GAME_CONFIG } from '../utils/constants.js';
import { getWobbleOffset, formatTime, formatScore, drunkifyText, clamp } from '../utils/helpers.js';
import { TIME_COLORS } from './DayNightSystem.js';

export class RenderSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = GAME_CONFIG.CANVAS_WIDTH;
        this.height = GAME_CONFIG.CANVAS_HEIGHT;

        // Smoke particles
        this.smokeParticles = [];

        // Screen shake
        this.shakeIntensity = 0;
        this.shakeDecay = 0.9;

        // Time for animations
        this.time = 0;

        // Achievement notification
        this.currentNotification = null;
        this.notificationTimer = 0;
        this.notificationDuration = 3000;

        // Day/night state
        this.dayNightColors = TIME_COLORS.morning;

        // Drunk effects state
        this.controlsInverted = false;
        this.invertedTimer = 0;
        this.colorCycleOffset = 0;
    }

    clear() {
        this.ctx.fillStyle = GAME_CONFIG.COLORS.BACKGROUND;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    update(deltaTime) {
        this.time += deltaTime;

        // Update shake
        this.shakeIntensity *= this.shakeDecay;

        // Update smoke particles
        this.smokeParticles = this.smokeParticles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= deltaTime;
            p.alpha = p.life / p.maxLife;
            p.size += 0.5;
            return p.life > 0;
        });

        // Update notification timer
        if (this.currentNotification) {
            this.notificationTimer -= deltaTime;
            if (this.notificationTimer <= 0) {
                this.currentNotification = null;
            }
        }

        // Update inverted controls timer
        if (this.invertedTimer > 0) {
            this.invertedTimer -= deltaTime;
            if (this.invertedTimer <= 0) {
                this.controlsInverted = false;
            }
        }

        // Update color cycle for extreme drunk
        this.colorCycleOffset += deltaTime * 0.001;
    }

    // Set day/night colors
    setDayNightColors(colors) {
        this.dayNightColors = colors;
    }

    // Show achievement notification
    showNotification(achievement) {
        this.currentNotification = achievement;
        this.notificationTimer = this.notificationDuration;
    }

    // Trigger control inversion (called from Game when drunk)
    triggerControlInversion(duration = 2000) {
        this.controlsInverted = true;
        this.invertedTimer = duration;
    }

    isControlsInverted() {
        return this.controlsInverted;
    }

    addShake(intensity) {
        this.shakeIntensity = Math.min(this.shakeIntensity + intensity, 20);
    }

    addSmokeParticle(x, y) {
        this.smokeParticles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -Math.random() * 1.5 - 0.5,
            size: 3 + Math.random() * 5,
            life: 1500 + Math.random() * 1000,
            maxLife: 1500 + Math.random() * 1000,
            alpha: 1
        });
    }

    // Apply drunk wobble and screen shake
    applyScreenEffects(drunkLevel) {
        const wobble = getWobbleOffset(this.time, drunkLevel, GAME_CONFIG.WOBBLE_INTENSITY);
        const shake = {
            x: (Math.random() - 0.5) * this.shakeIntensity,
            y: (Math.random() - 0.5) * this.shakeIntensity
        };

        this.ctx.save();
        this.ctx.translate(wobble.x + shake.x, wobble.y + shake.y);

        // Rotation wobble at high drunk levels
        if (drunkLevel >= 75) {
            const angle = Math.sin(this.time / 500) * 0.02 * (drunkLevel / 100);
            this.ctx.translate(this.width / 2, this.height / 2);
            this.ctx.rotate(angle);
            this.ctx.translate(-this.width / 2, -this.height / 2);
        }
    }

    resetScreenEffects() {
        this.ctx.restore();
    }

    // Draw the tile table background
    drawTable(dayNight = null, stars = []) {
        const tileSize = 40;
        const groutWidth = 3;
        const tableTop = this.height * 0.4;
        const colors = dayNight || this.dayNightColors;

        // Wall background (above table) - uses day/night colors
        const wallGradient = this.ctx.createLinearGradient(0, 0, 0, tableTop);
        wallGradient.addColorStop(0, colors.wall || '#4a3728');
        wallGradient.addColorStop(1, colors.wallAccent || '#3d2d1f');
        this.ctx.fillStyle = wallGradient;
        this.ctx.fillRect(0, 0, this.width, tableTop);

        // Wood paneling lines
        this.ctx.strokeStyle = this.adjustBrightness(colors.wallAccent || '#2a1a10', 0.7);
        this.ctx.lineWidth = 1;
        for (let y = 20; y < tableTop; y += 60) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }

        // Window (shows sky/time of day)
        this.drawWindow(400, 80, colors, stars);

        // Lamp (only visible at night)
        if (colors.lampOn) {
            this.drawLamp(580, 60);
        }

        // Clock on wall (80s style)
        this.drawWallClock(700, 100);

        // Neon sign / poster
        this.drawNeonSign(100, 120);

        // Table surface
        this.ctx.fillStyle = GAME_CONFIG.COLORS.TABLE_GROUT;
        this.ctx.fillRect(0, tableTop, this.width, this.height - tableTop);

        // Draw tiles - use seeded random for stable pattern
        for (let x = 0; x < this.width; x += tileSize + groutWidth) {
            for (let y = tableTop; y < this.height; y += tileSize + groutWidth) {
                // Pseudo-random based on position for stable rendering
                const seed = (x * 7 + y * 13) % 100;
                const brightness = 0.9 + (seed / 500);
                this.ctx.fillStyle = this.adjustBrightness(GAME_CONFIG.COLORS.TABLE_TILE, brightness);
                this.ctx.fillRect(x, y, tileSize, tileSize);
            }
        }

        // Table edge shadow
        const gradient = this.ctx.createLinearGradient(0, tableTop, 0, tableTop + 20);
        gradient.addColorStop(0, 'rgba(0,0,0,0.4)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, tableTop, this.width, 20);

        // Ambient lighting overlay
        if (colors.ambient) {
            this.ctx.fillStyle = colors.ambient;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        // Matches box on table
        this.drawMatchBox(650, 420);
    }

    // Draw window showing sky
    drawWindow(x, y, colors, stars = []) {
        const width = 120;
        const height = 100;

        // Window frame
        this.ctx.fillStyle = '#3a2a1a';
        this.ctx.fillRect(x - 5, y - 5, width + 10, height + 10);

        // Sky gradient
        const skyGradient = this.ctx.createLinearGradient(x, y, x, y + height);
        skyGradient.addColorStop(0, colors.sky || '#87ceeb');
        skyGradient.addColorStop(1, colors.skyGradient || '#b0e0e6');
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(x, y, width, height);

        // Stars (at night)
        if (colors.stars && stars.length > 0) {
            this.ctx.fillStyle = '#ffffff';
            for (const star of stars) {
                const sx = x + star.x * width;
                const sy = y + star.y * height * 0.6; // Upper portion only
                const twinkle = Math.sin(this.time / 1000 * star.twinkleSpeed + star.twinkleOffset);
                const alpha = 0.5 + twinkle * 0.5;
                this.ctx.globalAlpha = alpha;
                this.ctx.beginPath();
                this.ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.globalAlpha = 1;

            // Moon
            this.ctx.fillStyle = '#fffacd';
            this.ctx.beginPath();
            this.ctx.arc(x + width - 25, y + 25, 15, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Window glow
        const glowGradient = this.ctx.createRadialGradient(
            x + width / 2, y + height / 2, 0,
            x + width / 2, y + height / 2, width
        );
        glowGradient.addColorStop(0, 'rgba(255,255,255,0.1)');
        glowGradient.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = glowGradient;
        this.ctx.fillRect(x - 50, y - 50, width + 100, height + 100);

        // Window dividers
        this.ctx.strokeStyle = '#2a1a0a';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(x + width / 2, y);
        this.ctx.lineTo(x + width / 2, y + height);
        this.ctx.moveTo(x, y + height / 2);
        this.ctx.lineTo(x + width, y + height / 2);
        this.ctx.stroke();
    }

    // Draw desk lamp
    drawLamp(x, y) {
        // Lamp base
        this.ctx.fillStyle = '#444';
        this.ctx.fillRect(x - 15, y + 40, 30, 8);

        // Lamp arm
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + 40);
        this.ctx.lineTo(x - 10, y + 10);
        this.ctx.lineTo(x + 20, y - 10);
        this.ctx.stroke();

        // Lamp shade
        this.ctx.fillStyle = '#8b4513';
        this.ctx.beginPath();
        this.ctx.moveTo(x + 5, y - 20);
        this.ctx.lineTo(x + 40, y);
        this.ctx.lineTo(x, y);
        this.ctx.closePath();
        this.ctx.fill();

        // Light glow
        const glowGradient = this.ctx.createRadialGradient(x + 20, y - 5, 0, x + 20, y - 5, 80);
        glowGradient.addColorStop(0, 'rgba(255, 220, 150, 0.4)');
        glowGradient.addColorStop(0.5, 'rgba(255, 200, 100, 0.15)');
        glowGradient.addColorStop(1, 'rgba(255, 180, 50, 0)');
        this.ctx.fillStyle = glowGradient;
        this.ctx.fillRect(x - 60, y - 60, 160, 160);
    }

    // Draw a retro wall clock
    drawWallClock(x, y) {
        // Clock body
        this.ctx.fillStyle = '#222';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 35, 0, Math.PI * 2);
        this.ctx.fill();

        // Clock face
        this.ctx.fillStyle = '#eee';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 30, 0, Math.PI * 2);
        this.ctx.fill();

        // Hour markers
        this.ctx.fillStyle = '#333';
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const markerX = x + Math.cos(angle) * 24;
            const markerY = y + Math.sin(angle) * 24;
            this.ctx.beginPath();
            this.ctx.arc(markerX, markerY, 2, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Clock hands (animated)
        const seconds = (this.time / 1000) % 60;
        const minutes = (this.time / 60000) % 60;

        // Minute hand
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        const minAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + Math.cos(minAngle) * 20, y + Math.sin(minAngle) * 20);
        this.ctx.stroke();

        // Second hand
        this.ctx.strokeStyle = '#aa0000';
        this.ctx.lineWidth = 1;
        const secAngle = (seconds / 60) * Math.PI * 2 - Math.PI / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + Math.cos(secAngle) * 22, y + Math.sin(secAngle) * 22);
        this.ctx.stroke();

        // Center cap
        this.ctx.fillStyle = '#333';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }

    // Draw neon-style sign
    drawNeonSign(x, y) {
        const glow = Math.sin(this.time / 500) * 0.3 + 0.7;

        // Sign background
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(x - 60, y - 30, 120, 60);

        // Neon text
        this.ctx.font = 'bold 16px monospace';
        this.ctx.textAlign = 'center';

        // Glow effect
        this.ctx.shadowColor = `rgba(255, 100, 150, ${glow})`;
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = `rgba(255, 150, 180, ${glow})`;
        this.ctx.fillText('SMOKE', x, y - 5);
        this.ctx.fillText('BREAK', x, y + 15);

        // Reset shadow
        this.ctx.shadowBlur = 0;
    }

    // Draw match box
    drawMatchBox(x, y) {
        // Box
        this.ctx.fillStyle = '#8b4513';
        this.ctx.fillRect(x, y, 40, 25);

        // Label
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.fillRect(x + 5, y + 5, 30, 15);

        // Text on label
        this.ctx.fillStyle = '#8b0000';
        this.ctx.font = 'bold 8px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MATCH', x + 20, y + 15);
    }

    // Draw ashtray with cigarettes
    drawAshtray(x, y, queuedCigarettes) {
        // Ashtray base
        this.ctx.fillStyle = '#444';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, 60, 20, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Ashtray inner
        this.ctx.fillStyle = '#333';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y - 5, 50, 15, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Ash/debris
        this.ctx.fillStyle = '#666';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y - 5, 40, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw queued cigarettes
        for (let i = 0; i < queuedCigarettes; i++) {
            const angle = (i / queuedCigarettes) * Math.PI - Math.PI / 2;
            const cx = x + Math.cos(angle) * 30;
            const cy = y - 5 + Math.sin(angle) * 8;
            this.drawCigarette(cx, cy, angle + Math.PI / 2, 1, false);
        }
    }

    // Draw a single cigarette
    drawCigarette(x, y, angle, capacity, lit) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);

        const length = 35;
        const filterLength = 10;
        const width = 4;

        // Filter
        this.ctx.fillStyle = GAME_CONFIG.COLORS.CIGARETTE_FILTER;
        this.ctx.fillRect(-filterLength, -width / 2, filterLength, width);

        // Paper (length based on capacity)
        const paperLength = (length - filterLength) * capacity;
        this.ctx.fillStyle = GAME_CONFIG.COLORS.CIGARETTE_PAPER;
        this.ctx.fillRect(0, -width / 2, paperLength, width);

        // Ember
        if (lit) {
            this.ctx.fillStyle = GAME_CONFIG.COLORS.CIGARETTE_EMBER;
            this.ctx.fillRect(paperLength - 2, -width / 2, 3, width);

            // Glow
            const glowGradient = this.ctx.createRadialGradient(paperLength, 0, 0, paperLength, 0, 10);
            glowGradient.addColorStop(0, 'rgba(255, 100, 0, 0.5)');
            glowGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
            this.ctx.fillStyle = glowGradient;
            this.ctx.fillRect(paperLength - 10, -10, 20, 20);
        }

        this.ctx.restore();
    }

    // Draw beer glass
    drawBeerGlass(x, y, sipLevel) {
        const glassWidth = 30;
        const glassHeight = 50;
        const fillLevel = 0.3 + sipLevel * 0.6; // Always at least 30% visible

        // Glass
        this.ctx.fillStyle = 'rgba(200, 230, 255, 0.3)';
        this.ctx.fillRect(x - glassWidth / 2, y - glassHeight, glassWidth, glassHeight);

        // Beer liquid
        const beerHeight = glassHeight * fillLevel;
        this.ctx.fillStyle = GAME_CONFIG.COLORS.BEER_LIQUID;
        this.ctx.fillRect(x - glassWidth / 2 + 2, y - beerHeight, glassWidth - 4, beerHeight - 2);

        // Foam
        this.ctx.fillStyle = '#fff8dc';
        this.ctx.fillRect(x - glassWidth / 2 + 2, y - beerHeight - 5, glassWidth - 4, 7);

        // Glass highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(x - glassWidth / 2 + 3, y - glassHeight + 5, 3, glassHeight - 10);
    }

    // Draw a hand holding something
    drawHand(x, y, drunkLevel) {
        const wobble = getWobbleOffset(this.time, drunkLevel, 2);
        const handX = x + wobble.x;
        const handY = y + wobble.y;

        this.ctx.save();
        this.ctx.translate(handX, handY);

        // Skin tone
        this.ctx.fillStyle = '#e8beac';

        // Palm
        this.ctx.beginPath();
        this.ctx.ellipse(0, 15, 25, 20, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Fingers (curled around cigarette)
        const fingerPositions = [
            { x: -15, y: -5, angle: -0.3 },
            { x: -8, y: -12, angle: -0.15 },
            { x: 2, y: -15, angle: 0 },
            { x: 12, y: -10, angle: 0.2 }
        ];

        fingerPositions.forEach(f => {
            this.ctx.save();
            this.ctx.translate(f.x, f.y);
            this.ctx.rotate(f.angle);
            this.ctx.fillStyle = '#e8beac';
            this.ctx.fillRect(-4, -20, 8, 22);
            // Fingertip
            this.ctx.beginPath();
            this.ctx.arc(0, -20, 4, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });

        // Thumb
        this.ctx.save();
        this.ctx.translate(20, 5);
        this.ctx.rotate(0.5);
        this.ctx.fillRect(-4, -15, 9, 18);
        this.ctx.beginPath();
        this.ctx.arc(0, -15, 4.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        this.ctx.restore();
    }

    // Draw current cigarette being smoked (in "hand")
    drawCurrentCigarette(x, y, capacity, isSmoking, drunkLevel) {
        // Hand wobble when drunk
        const wobble = getWobbleOffset(this.time, drunkLevel, 2);

        // Draw hand first
        this.drawHand(x - 20, y + 10, drunkLevel);

        this.drawCigarette(
            x + wobble.x,
            y + wobble.y,
            -0.3 + Math.sin(this.time / 1000) * 0.05,
            capacity / GAME_CONFIG.CIGARETTE_CAPACITY,
            true
        );

        // Add smoke
        if (isSmoking) {
            for (let i = 0; i < 3; i++) {
                this.addSmokeParticle(x + 35 + wobble.x, y - 5 + wobble.y);
            }
        } else {
            // Idle smoke
            if (Math.random() < 0.1) {
                this.addSmokeParticle(x + 35 + wobble.x, y - 5 + wobble.y);
            }
        }
    }

    // Draw all smoke particles
    drawSmoke() {
        for (const p of this.smokeParticles) {
            this.ctx.globalAlpha = p.alpha * 0.5;
            this.ctx.fillStyle = GAME_CONFIG.COLORS.SMOKE;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
    }

    // Draw a meter (oxygen, drowsiness, etc.)
    drawMeter(x, y, width, height, value, max, dangerThreshold, label, inverted = false) {
        const percent = value / max;
        const fillWidth = width * percent;

        // Determine color
        let color = GAME_CONFIG.COLORS.METER_OK;
        if (inverted) {
            if (value >= dangerThreshold) color = GAME_CONFIG.COLORS.METER_DANGER;
            else if (value >= dangerThreshold * 0.7) color = GAME_CONFIG.COLORS.METER_WARNING;
        } else {
            if (value <= dangerThreshold) color = GAME_CONFIG.COLORS.METER_DANGER;
            else if (value <= dangerThreshold * 1.3) color = GAME_CONFIG.COLORS.METER_WARNING;
        }

        // Background
        this.ctx.fillStyle = GAME_CONFIG.COLORS.UI_BG;
        this.ctx.fillRect(x, y, width, height);

        // Fill
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x + 2, y + 2, fillWidth - 4, height - 4);

        // Danger pulse
        if ((inverted && value >= dangerThreshold) || (!inverted && value <= dangerThreshold)) {
            const pulse = Math.sin(this.time / 100) * 0.3 + 0.7;
            this.ctx.fillStyle = `rgba(255, 0, 0, ${pulse * 0.3})`;
            this.ctx.fillRect(x, y, width, height);
        }

        // Border
        this.ctx.strokeStyle = GAME_CONFIG.COLORS.UI_BORDER;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        // Label
        this.ctx.fillStyle = GAME_CONFIG.COLORS.TEXT;
        this.ctx.font = 'bold 12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(label, x, y - 5);

        // Value
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`${Math.floor(value)}%`, x + width, y - 5);
    }

    // Draw stuffing mini-game UI
    drawStuffingUI(info, drunkLevel) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // Darken background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Title
        this.ctx.fillStyle = GAME_CONFIG.COLORS.TEXT;
        this.ctx.font = 'bold 24px monospace';
        this.ctx.textAlign = 'center';
        const title = drunkifyText('STUFF THAT CIGARETTE!', drunkLevel);
        this.ctx.fillText(title, centerX, centerY - 100);

        // Sequence display - dynamically sized to fit screen
        const maxWidth = this.width - 80; // Leave 40px padding on each side
        const gap = 8;
        const numKeys = info.sequence.length;
        const keySize = Math.min(50, Math.floor((maxWidth - (numKeys - 1) * gap) / numKeys));
        const fontSize = Math.max(14, Math.min(24, keySize - 10));

        const totalWidth = numKeys * keySize + (numKeys - 1) * gap;
        const startX = centerX - totalWidth / 2;

        for (let i = 0; i < numKeys; i++) {
            const x = startX + i * (keySize + gap);
            const y = centerY - 30;

            // Key background
            if (i < info.currentIndex) {
                this.ctx.fillStyle = '#44aa44'; // Completed
            } else if (i === info.currentIndex) {
                this.ctx.fillStyle = '#4444aa'; // Current
                // Pulse effect
                const pulse = Math.sin(this.time / 150) * 4;
                this.ctx.fillRect(x - pulse / 2, y - pulse / 2, keySize + pulse, keySize + pulse);
            } else {
                this.ctx.fillStyle = '#444444'; // Upcoming
            }
            this.ctx.fillRect(x, y, keySize, keySize);

            // Key border
            this.ctx.strokeStyle = '#888';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, keySize, keySize);

            // Key letter
            this.ctx.fillStyle = GAME_CONFIG.COLORS.TEXT;
            this.ctx.font = `bold ${fontSize}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(info.sequence[i].toUpperCase(), x + keySize / 2, y + keySize / 2);
        }

        // Timer bar
        const timerWidth = 300;
        const timerPercent = info.timeRemaining / info.timeMax;
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(centerX - timerWidth / 2, centerY + 50, timerWidth, 20);
        this.ctx.fillStyle = timerPercent > 0.3 ? '#44aa44' : '#aa4444';
        this.ctx.fillRect(centerX - timerWidth / 2, centerY + 50, timerWidth * timerPercent, 20);

        // Mistakes
        this.ctx.fillStyle = GAME_CONFIG.COLORS.TEXT;
        this.ctx.font = '16px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Mistakes: ${info.mistakes}/${info.maxMistakes}`, centerX, centerY + 90);

        // Key feedback
        if (info.keyFeedback) {
            this.ctx.fillStyle = info.keyFeedback.success ? '#44ff44' : '#ff4444';
            this.ctx.font = 'bold 32px monospace';
            this.ctx.fillText(
                info.keyFeedback.success ? 'GOOD!' : 'MISS!',
                centerX,
                centerY + 130
            );
        }

        this.ctx.textBaseline = 'alphabetic';
    }

    // Draw HUD
    drawHUD(player) {
        const padding = 20;
        const meterWidth = 150;
        const meterHeight = 20;

        // Oxygen meter (left)
        this.drawMeter(
            padding, padding + 20,
            meterWidth, meterHeight,
            player.oxygen, GAME_CONFIG.OXYGEN_MAX,
            GAME_CONFIG.OXYGEN_DANGER_THRESHOLD,
            'OXYGEN (keep low!)',
            true
        );

        // Drowsiness meter
        this.drawMeter(
            padding, padding + 70,
            meterWidth, meterHeight,
            player.drowsiness, GAME_CONFIG.DROWSINESS_MAX,
            GAME_CONFIG.DROWSINESS_DANGER_THRESHOLD,
            'DROWSINESS',
            true
        );

        // Drunkenness meter
        this.drawMeter(
            padding, padding + 120,
            meterWidth, meterHeight,
            player.drunkenness, GAME_CONFIG.DRUNKENNESS_MAX,
            0, // No danger threshold for drunk
            'DRUNKENNESS',
            false
        );

        // Cigarette indicator (top right)
        this.ctx.fillStyle = GAME_CONFIG.COLORS.TEXT;
        this.ctx.font = 'bold 14px monospace';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`CIGARETTES: ${player.queuedCigarettes}`, this.width - padding, padding + 20);

        // Current cigarette capacity
        const capacityPercent = player.currentCigarette / GAME_CONFIG.CIGARETTE_CAPACITY;
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(this.width - padding - meterWidth, padding + 30, meterWidth, 10);
        this.ctx.fillStyle = capacityPercent > 0.3 ? '#ddd' : '#ff8844';
        this.ctx.fillRect(this.width - padding - meterWidth, padding + 30, meterWidth * capacityPercent, 10);

        // Score and time (top center)
        this.ctx.fillStyle = GAME_CONFIG.COLORS.TEXT;
        this.ctx.font = 'bold 20px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`SCORE: ${formatScore(player.score)}`, this.width / 2, padding + 20);
        this.ctx.font = '16px monospace';
        this.ctx.fillText(`TIME: ${formatTime(player.timeAlive)}`, this.width / 2, padding + 45);

        // Hiccup indicator
        if (player.isHiccuping) {
            this.ctx.fillStyle = '#ffcc00';
            this.ctx.font = 'bold 24px monospace';
            this.ctx.textAlign = 'center';
            // Shake effect for hiccup text
            const shakeX = (Math.random() - 0.5) * 8;
            const shakeY = (Math.random() - 0.5) * 8;
            this.ctx.fillText('*HIC*', this.width / 2 + shakeX, this.height / 2 - 50 + shakeY);
        }

        // Control hints (bottom)
        this.ctx.font = '12px monospace';
        this.ctx.fillStyle = '#888';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('[SPACE] Smoke  |  [B] Drink Beer  |  [WASD] Stuff Cigarettes', this.width / 2, this.height - 15);
    }

    // Draw menu screen
    drawMenu(highScore = 0) {
        this.clear();

        // Title with CRT effect
        this.ctx.fillStyle = GAME_CONFIG.COLORS.TEXT;
        this.ctx.font = 'bold 48px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SMOKING', this.width / 2, 150);
        this.ctx.fillText('SIMULATOR', this.width / 2, 200);

        this.ctx.font = '24px monospace';
        this.ctx.fillStyle = '#c9a959';
        this.ctx.fillText('Tile Table Edition (1987)', this.width / 2, 250);

        // High score
        if (highScore > 0) {
            this.ctx.font = 'bold 18px monospace';
            this.ctx.fillStyle = '#ffcc00';
            this.ctx.fillText(`HIGH SCORE: ${formatScore(highScore)}`, this.width / 2, 285);
        }

        // Instructions
        this.ctx.font = '16px monospace';
        this.ctx.fillStyle = '#aaa';
        const instructions = [
            'Survive as long as you can!',
            '',
            'Press SPACE to smoke (avoid oxygen overdose)',
            'Press B to drink beer (stay awake)',
            'Press WASD to stuff new cigarettes',
            '',
            'Warning: Drinking makes everything harder!'
        ];

        instructions.forEach((line, i) => {
            this.ctx.fillText(line, this.width / 2, 320 + i * 25);
        });

        // Start prompt
        this.ctx.font = 'bold 20px monospace';
        this.ctx.fillStyle = '#fff';
        const blink = Math.sin(this.time / 300) > 0;
        if (blink) {
            this.ctx.fillText('Press ENTER to Start', this.width / 2, 510);
        }

        // Menu navigation hints
        this.ctx.font = '12px monospace';
        this.ctx.fillStyle = '#666';
        this.ctx.fillText('[A] Achievements  |  [L] Leaderboard', this.width / 2, 545);

        this.drawCRTEffect();
    }

    // Draw game over screen
    drawGameOver(player, deathCause, highScore = 0, isNewHighScore = false) {
        // Darken
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Game Over text
        this.ctx.fillStyle = '#ff4444';
        this.ctx.font = 'bold 48px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.width / 2, 120);

        // New high score celebration
        if (isNewHighScore) {
            this.ctx.fillStyle = '#ffcc00';
            this.ctx.font = 'bold 28px monospace';
            const pulse = Math.sin(this.time / 200) * 0.3 + 0.7;
            this.ctx.globalAlpha = pulse;
            this.ctx.fillText('NEW HIGH SCORE!', this.width / 2, 165);
            this.ctx.globalAlpha = 1;
        }

        // Death cause
        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '16px monospace';
        this.ctx.fillText(deathCause, this.width / 2, 200);

        // Stats
        this.ctx.fillStyle = GAME_CONFIG.COLORS.TEXT;
        this.ctx.font = '24px monospace';
        this.ctx.fillText(`Final Score: ${formatScore(player.score)}`, this.width / 2, 260);

        if (!isNewHighScore && highScore > 0) {
            this.ctx.font = '16px monospace';
            this.ctx.fillStyle = '#888';
            this.ctx.fillText(`High Score: ${formatScore(highScore)}`, this.width / 2, 290);
        }

        this.ctx.fillStyle = GAME_CONFIG.COLORS.TEXT;
        this.ctx.font = '20px monospace';
        this.ctx.fillText(`Time Survived: ${formatTime(player.timeAlive)}`, this.width / 2, 330);
        this.ctx.font = '16px monospace';
        this.ctx.fillText(`Cigarettes Smoked: ${player.totalCigarettesSmoked}`, this.width / 2, 370);
        this.ctx.fillText(`Beers Consumed: ${player.totalBeersConsumed.toFixed(1)}`, this.width / 2, 400);

        // Restart prompt
        this.ctx.font = 'bold 20px monospace';
        this.ctx.fillStyle = '#fff';
        const blink = Math.sin(this.time / 300) > 0;
        if (blink) {
            this.ctx.fillText('Press ENTER to Try Again', this.width / 2, 460);
        }

        // Navigation hint
        this.ctx.fillStyle = '#666';
        this.ctx.font = '14px monospace';
        this.ctx.fillText('[L] View Leaderboard', this.width / 2, 500);
    }

    // Draw CRT scanline effect
    drawCRTEffect() {
        // Scanlines
        this.ctx.fillStyle = `rgba(0, 0, 0, ${GAME_CONFIG.CRT_SCANLINE_OPACITY})`;
        for (let y = 0; y < this.height; y += 4) {
            this.ctx.fillRect(0, y, this.width, 2);
        }

        // Vignette
        const gradient = this.ctx.createRadialGradient(
            this.width / 2, this.height / 2, this.height / 3,
            this.width / 2, this.height / 2, this.height
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Draw drunk blur effect
    drawDrunkBlur(drunkLevel) {
        if (drunkLevel < 50) return;

        const intensity = (drunkLevel - 50) / 50 * 0.3;
        this.ctx.globalAlpha = intensity;

        // Simple blur effect by drawing offset copies
        const offsets = [
            { x: -2, y: 0 },
            { x: 2, y: 0 },
            { x: 0, y: -2 },
            { x: 0, y: 2 }
        ];

        // This is a simplified effect - real blur would need off-screen canvas
        this.ctx.globalAlpha = 1;
    }

    // Adjust color brightness
    adjustBrightness(hex, factor) {
        // Handle rgb format
        if (hex.startsWith('rgb')) {
            const match = hex.match(/\d+/g);
            if (match) {
                const r = Math.min(255, Math.floor(parseInt(match[0]) * factor));
                const g = Math.min(255, Math.floor(parseInt(match[1]) * factor));
                const b = Math.min(255, Math.floor(parseInt(match[2]) * factor));
                return `rgb(${r},${g},${b})`;
            }
        }
        // Handle hex format
        if (!hex.startsWith('#')) return hex;
        const r = Math.min(255, Math.floor(parseInt(hex.slice(1, 3), 16) * factor));
        const g = Math.min(255, Math.floor(parseInt(hex.slice(3, 5), 16) * factor));
        const b = Math.min(255, Math.floor(parseInt(hex.slice(5, 7), 16) * factor));
        return `rgb(${r},${g},${b})`;
    }

    // Draw achievement notification toast
    drawAchievementNotification() {
        if (!this.currentNotification) return;

        const achievement = this.currentNotification;
        const progress = this.notificationTimer / this.notificationDuration;

        // Slide in/out animation
        let yOffset = 0;
        if (progress > 0.9) {
            yOffset = (1 - progress) / 0.1 * -80; // Slide in
        } else if (progress < 0.1) {
            yOffset = (0.1 - progress) / 0.1 * -80; // Slide out
        }

        const x = this.width / 2;
        const y = 80 + yOffset;
        const width = 280;
        const height = 60;

        // Background
        this.ctx.fillStyle = 'rgba(50, 50, 80, 0.95)';
        this.ctx.fillRect(x - width / 2, y - height / 2, width, height);

        // Gold border
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(x - width / 2, y - height / 2, width, height);

        // Icon
        this.ctx.font = '28px serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(achievement.icon, x - width / 2 + 15, y + 8);

        // Title
        this.ctx.fillStyle = '#ffd700';
        this.ctx.font = 'bold 14px monospace';
        this.ctx.fillText('ACHIEVEMENT UNLOCKED!', x - width / 2 + 55, y - 10);

        // Name
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 16px monospace';
        this.ctx.fillText(achievement.name, x - width / 2 + 55, y + 12);

        this.ctx.textAlign = 'center';
    }

    // Draw leaderboard (compact version for menu)
    drawLeaderboard(entries, playerRank = null) {
        const startX = this.width / 2;
        const startY = 180;
        const lineHeight = 28;
        const width = 350;

        // Title
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.font = 'bold 20px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('LEADERBOARD', startX, startY - 20);

        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(startX - width / 2, startY, width, entries.length * lineHeight + 20);

        // Entries
        entries.forEach((entry, i) => {
            const y = startY + 25 + i * lineHeight;
            const rank = i + 1;

            // Highlight player entry
            if (entry.isPlayer) {
                this.ctx.fillStyle = 'rgba(100, 150, 255, 0.3)';
                this.ctx.fillRect(startX - width / 2 + 5, y - 18, width - 10, lineHeight - 2);
            }

            // Rank
            this.ctx.fillStyle = rank <= 3 ? '#ffd700' : '#888';
            this.ctx.font = 'bold 14px monospace';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`${rank}.`, startX - width / 2 + 35, y);

            // Name
            this.ctx.fillStyle = entry.isPlayer ? '#88ccff' : '#fff';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(entry.name, startX - width / 2 + 45, y);

            // Score
            this.ctx.fillStyle = entry.isPlayer ? '#88ccff' : '#aaa';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(formatScore(entry.score), startX + width / 2 - 15, y);
        });

        this.ctx.textAlign = 'center';
    }

    // Draw full screen leaderboard (for game over state)
    drawLeaderboardFullScreen(entries, playerRank = null) {
        // Dark overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        const startX = this.width / 2;
        const startY = 100;
        const lineHeight = 35;
        const width = 500;

        // Title
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.font = 'bold 36px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('LEADERBOARD', startX, startY);

        // Subtitle with player rank
        if (playerRank && playerRank <= 10) {
            this.ctx.fillStyle = '#88ff88';
            this.ctx.font = '16px monospace';
            this.ctx.fillText(`You placed #${playerRank}!`, startX, startY + 30);
        }

        // Header row
        const headerY = startY + 60;
        this.ctx.fillStyle = '#888';
        this.ctx.font = 'bold 12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('RANK', startX - width / 2 + 10, headerY);
        this.ctx.fillText('NAME', startX - width / 2 + 70, headerY);
        this.ctx.textAlign = 'right';
        this.ctx.fillText('SCORE', startX + width / 2 - 100, headerY);
        this.ctx.fillText('TIME', startX + width / 2 - 10, headerY);

        // Divider
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(startX - width / 2, headerY + 10);
        this.ctx.lineTo(startX + width / 2, headerY + 10);
        this.ctx.stroke();

        // Entries
        entries.forEach((entry, i) => {
            const y = startY + 95 + i * lineHeight;
            const rank = i + 1;

            // Highlight player entry
            if (entry.isPlayer) {
                this.ctx.fillStyle = 'rgba(100, 150, 255, 0.2)';
                this.ctx.fillRect(startX - width / 2, y - 22, width, lineHeight - 2);
            }

            // Medal for top 3
            this.ctx.font = '18px serif';
            this.ctx.textAlign = 'center';
            if (rank === 1) {
                this.ctx.fillText('🥇', startX - width / 2 + 30, y);
            } else if (rank === 2) {
                this.ctx.fillText('🥈', startX - width / 2 + 30, y);
            } else if (rank === 3) {
                this.ctx.fillText('🥉', startX - width / 2 + 30, y);
            } else {
                this.ctx.fillStyle = '#666';
                this.ctx.font = 'bold 16px monospace';
                this.ctx.fillText(`${rank}`, startX - width / 2 + 30, y);
            }

            // Name
            this.ctx.fillStyle = entry.isPlayer ? '#88ccff' : '#fff';
            this.ctx.font = entry.isPlayer ? 'bold 16px monospace' : '16px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(entry.name, startX - width / 2 + 70, y);

            // Score
            this.ctx.fillStyle = entry.isPlayer ? '#88ccff' : '#aaa';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(formatScore(entry.score), startX + width / 2 - 100, y);

            // Time (format as MM:SS)
            this.ctx.fillStyle = '#666';
            const mins = Math.floor(entry.time / 60);
            const secs = Math.floor(entry.time % 60);
            this.ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, startX + width / 2 - 10, y);
        });

        // Navigation hint
        this.ctx.fillStyle = '#666';
        this.ctx.font = '14px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('[L] Toggle View  |  [ENTER] Return to Menu', startX, this.height - 40);
    }

    // Draw achievements gallery
    drawAchievements(achievements, startY = 320) {
        const cols = 4;
        const itemSize = 60;
        const gap = 15;
        const totalWidth = cols * itemSize + (cols - 1) * gap;
        const startX = (this.width - totalWidth) / 2;

        this.ctx.font = 'bold 16px monospace';
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.textAlign = 'center';

        const unlocked = achievements.filter(a => a.unlocked).length;
        this.ctx.fillText(`ACHIEVEMENTS (${unlocked}/${achievements.length})`, this.width / 2, startY - 10);

        achievements.forEach((ach, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (itemSize + gap);
            const y = startY + 10 + row * (itemSize + gap);

            // Background
            this.ctx.fillStyle = ach.unlocked ? 'rgba(100, 150, 100, 0.5)' : 'rgba(50, 50, 50, 0.5)';
            this.ctx.fillRect(x, y, itemSize, itemSize);

            // Border
            this.ctx.strokeStyle = ach.unlocked ? '#88cc88' : '#444';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, itemSize, itemSize);

            // Icon or lock
            this.ctx.font = '24px serif';
            this.ctx.textAlign = 'center';
            if (ach.unlocked) {
                this.ctx.fillText(ach.icon, x + itemSize / 2, y + itemSize / 2 + 8);
            } else {
                this.ctx.fillStyle = '#666';
                this.ctx.fillText('🔒', x + itemSize / 2, y + itemSize / 2 + 8);
            }
        });

        this.ctx.textAlign = 'center';
    }

    // Enhanced drunk effects
    applyDrunkEffects(drunkLevel) {
        if (drunkLevel < 50) return;

        // Double vision effect (60%+) - use offset colored overlays instead of drawImage
        // (drawImage of canvas to itself causes performance issues)
        if (drunkLevel >= 60) {
            const intensity = (drunkLevel - 60) / 40;
            const offset = intensity * 6;

            // Create ghost effect with offset semi-transparent overlays
            this.ctx.globalAlpha = intensity * 0.15;
            this.ctx.fillStyle = '#ff8888';
            this.ctx.fillRect(offset, offset / 2, this.width, this.height);
            this.ctx.fillStyle = '#8888ff';
            this.ctx.fillRect(-offset, -offset / 2, this.width, this.height);
            this.ctx.globalAlpha = 1;
        }

        // Color saturation/shift (50%+)
        if (drunkLevel >= 50) {
            const intensity = (drunkLevel - 50) / 50 * 0.12;
            // Warm color overlay
            this.ctx.fillStyle = `rgba(255, 200, 150, ${intensity})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        // Color cycling at extreme drunk (95%+)
        if (drunkLevel >= 95) {
            const hue = (this.colorCycleOffset * 50) % 360;
            this.ctx.fillStyle = `hsla(${hue}, 50%, 50%, 0.1)`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
    }

    // Draw inverted controls warning
    drawInvertedWarning() {
        if (!this.controlsInverted) return;

        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = 'bold 24px monospace';
        this.ctx.textAlign = 'center';
        const shake = Math.sin(this.time / 50) * 3;
        this.ctx.fillText('CONTROLS INVERTED!', this.width / 2 + shake, this.height / 2 - 80);
    }

    // Draw time of day indicator
    drawTimeIndicator(phaseName) {
        this.ctx.fillStyle = '#888';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(phaseName, this.width - 20, this.height - 35);
    }

    // Draw name entry screen
    drawNameEntry(currentName, cursorVisible, playerScore, isNewHighScore) {
        // Darken background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Title
        this.ctx.fillStyle = isNewHighScore ? '#ffcc00' : '#fff';
        this.ctx.font = 'bold 32px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(isNewHighScore ? 'NEW HIGH SCORE!' : 'ENTER YOUR NAME', this.width / 2, 150);

        // Score display
        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '20px monospace';
        this.ctx.fillText(`Score: ${formatScore(playerScore)}`, this.width / 2, 190);

        // Name entry box
        const boxWidth = 280;
        const boxHeight = 50;
        const boxX = (this.width - boxWidth) / 2;
        const boxY = 230;

        // Box background
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Box border
        this.ctx.strokeStyle = '#888';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Name text
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 28px monospace';
        this.ctx.textAlign = 'center';

        const displayName = currentName + (cursorVisible ? '_' : '');
        this.ctx.fillText(displayName, this.width / 2, boxY + 35);

        // Instructions
        this.ctx.fillStyle = '#888';
        this.ctx.font = '14px monospace';
        this.ctx.fillText('Type your name (max 12 characters)', this.width / 2, boxY + 80);
        this.ctx.fillText('Press ENTER to confirm  |  BACKSPACE to delete', this.width / 2, boxY + 105);

        // Preview hint
        this.ctx.fillStyle = '#666';
        this.ctx.font = '12px monospace';
        this.ctx.fillText('Your name will appear on the leaderboard', this.width / 2, boxY + 140);
    }
}
