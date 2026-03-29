import { GAME_CONFIG } from '../utils/constants.js';
import { getWobbleOffset, formatTime, formatScore, drunkifyText, clamp } from '../utils/helpers.js';
import { TIME_COLORS } from './DayNightSystem.js';

// Screen zones for ego perspective layout (Y coordinates)
const ZONES = {
    WALL: { y: 0, height: 200 },
    TABLE: { y: 200, height: 250 },
    BELLY: { y: 450, height: 90 },
    HUD: { y: 540, height: 60 }
};

// Room colors
const ROOM_COLORS = {
    WALLPAPER_STRIPE_1: '#5a4a3a',
    WALLPAPER_STRIPE_2: '#4a3a2a',
    WALLPAPER_ACCENT: '#6a5a4a',
    RADIATOR: '#c0c0c0',
    RADIATOR_DARK: '#808080',
    TV_CABINET: '#3a2a1a',
    TV_SCREEN_OFF: '#1a1a1a',
    SHELF: '#5a4030',
    BOTTLE_GREEN: '#2a5a2a',
    BOTTLE_BROWN: '#5a3a1a',
    SKIN_TONE: '#e8beac',
    SKIN_TONE_DARK: '#d4a090',
    TSHIRT_GRAY: '#4a4a4a',
    TSHIRT_STAIN: '#3a3a3a',
    BELLY_HAIR: '#6a5a4a'
};

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

        // Gaming mode effects
        this.levelUpFlashTimer = 0;
        this.speedLineOffset = 0;

        // TV static animation
        this.tvStaticFrame = 0;

        // Beer belly breathing animation
        this.bellyBreathPhase = 0;

        // Current drunk level for belly size
        this.currentDrunkLevel = 0;
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

        // Update level-up flash
        if (this.levelUpFlashTimer > 0) {
            this.levelUpFlashTimer -= deltaTime;
        }

        // Update speed line animation
        this.speedLineOffset += deltaTime * 0.5;

        // Update TV static
        this.tvStaticFrame += deltaTime * 0.03;

        // Update belly breathing (slow, relaxed breathing)
        this.bellyBreathPhase += deltaTime * 0.002;
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

    // Trigger level-up flash (Gaming mode)
    triggerLevelUpFlash() {
        this.levelUpFlashTimer = 500; // 500ms flash
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

    // Store drunk level for belly rendering
    setDrunkLevel(level) {
        this.currentDrunkLevel = level;
    }

    // Draw the complete room scene (ego perspective)
    drawTable(dayNight = null, stars = []) {
        const colors = dayNight || this.dayNightColors;

        // Draw room background (wall zone)
        this.drawRoom(colors, stars);

        // Draw TV on the left
        this.drawTV(60, 50, colors);

        // Draw perspective table in the middle zone
        this.drawTablePerspective(colors);

        // Draw beer belly at the bottom (foreground)
        this.drawBeerBelly(this.currentDrunkLevel);

        // Ambient lighting overlay
        if (colors.ambient) {
            this.ctx.fillStyle = colors.ambient;
            this.ctx.fillRect(0, 0, this.width, ZONES.BELLY.y);
        }

        // Room haze from smoke (subtle overlay)
        const smokeHaze = Math.min(this.smokeParticles.length / 50, 0.15);
        if (smokeHaze > 0) {
            this.ctx.fillStyle = `rgba(180, 180, 180, ${smokeHaze})`;
            this.ctx.fillRect(0, 0, this.width, ZONES.BELLY.y);
        }
    }

    // Draw room background with wallpaper, decorations
    drawRoom(colors, stars = []) {
        const wallHeight = ZONES.WALL.height;

        // Wallpaper - striped pattern
        const stripeWidth = 30;
        for (let x = 0; x < this.width; x += stripeWidth) {
            const stripeIndex = Math.floor(x / stripeWidth);
            const baseColor = stripeIndex % 2 === 0 ? ROOM_COLORS.WALLPAPER_STRIPE_1 : ROOM_COLORS.WALLPAPER_STRIPE_2;
            // Adjust for day/night
            this.ctx.fillStyle = this.blendColors(baseColor, colors.wall || baseColor, 0.5);
            this.ctx.fillRect(x, 0, stripeWidth, wallHeight);
        }

        // Wallpaper trim at bottom of wall
        this.ctx.fillStyle = ROOM_COLORS.WALLPAPER_ACCENT;
        this.ctx.fillRect(0, wallHeight - 15, this.width, 15);

        // Window with blinds (right side)
        this.drawWindow(580, 30, colors, stars);

        // Radiator under window
        this.drawRadiator(560, 160);

        // Beer bottles on shelf (right side)
        this.drawShelfWithBottles(680, 100);

        // Poster/calendar on wall (left-center)
        this.drawPoster(250, 40);

        // Clock on wall (repositioned)
        this.drawWallClock(420, 60);

        // Lamp glow (only at night)
        if (colors.lampOn) {
            this.drawLampGlow(colors);
        }
    }

    // Draw CRT TV with static/animated content
    drawTV(x, y, colors) {
        const tvWidth = 140;
        const tvHeight = 110;
        const screenWidth = 100;
        const screenHeight = 75;
        const screenX = x + (tvWidth - screenWidth) / 2;
        const screenY = y + 20;

        // TV stand/shelf
        this.ctx.fillStyle = '#2a1a0a';
        this.ctx.fillRect(x - 10, y + tvHeight - 5, tvWidth + 20, 15);

        // TV cabinet (wood grain)
        const cabinetGrad = this.ctx.createLinearGradient(x, y, x + tvWidth, y);
        cabinetGrad.addColorStop(0, '#4a3020');
        cabinetGrad.addColorStop(0.5, '#5a4030');
        cabinetGrad.addColorStop(1, '#4a3020');
        this.ctx.fillStyle = cabinetGrad;
        this.ctx.fillRect(x, y, tvWidth, tvHeight);

        // TV screen bezel
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(screenX - 5, screenY - 5, screenWidth + 10, screenHeight + 10);

        // TV screen with static
        this.drawTVScreen(screenX, screenY, screenWidth, screenHeight, colors);

        // TV antenna
        this.ctx.strokeStyle = '#555';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(x + tvWidth / 2, y);
        this.ctx.lineTo(x + tvWidth / 2 - 25, y - 35);
        this.ctx.moveTo(x + tvWidth / 2, y);
        this.ctx.lineTo(x + tvWidth / 2 + 25, y - 35);
        this.ctx.stroke();

        // Antenna tips
        this.ctx.fillStyle = '#666';
        this.ctx.beginPath();
        this.ctx.arc(x + tvWidth / 2 - 25, y - 35, 4, 0, Math.PI * 2);
        this.ctx.arc(x + tvWidth / 2 + 25, y - 35, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // TV control knobs
        this.ctx.fillStyle = '#333';
        this.ctx.beginPath();
        this.ctx.arc(x + tvWidth - 20, y + tvHeight - 25, 6, 0, Math.PI * 2);
        this.ctx.arc(x + tvWidth - 20, y + tvHeight - 45, 6, 0, Math.PI * 2);
        this.ctx.fill();

        // TV glow effect on surrounding area
        const glowIntensity = colors.lampOn ? 0.15 : 0.25;
        const glowGrad = this.ctx.createRadialGradient(
            screenX + screenWidth / 2, screenY + screenHeight / 2, 0,
            screenX + screenWidth / 2, screenY + screenHeight / 2, 150
        );
        glowGrad.addColorStop(0, `rgba(100, 150, 200, ${glowIntensity})`);
        glowGrad.addColorStop(1, 'rgba(100, 150, 200, 0)');
        this.ctx.fillStyle = glowGrad;
        this.ctx.fillRect(0, 0, 300, 200);
    }

    // Draw TV screen content with static
    drawTVScreen(x, y, width, height, colors) {
        // Base screen color
        this.ctx.fillStyle = '#0a0a15';
        this.ctx.fillRect(x, y, width, height);

        // Static noise pattern
        const staticIntensity = 0.3 + Math.sin(this.tvStaticFrame) * 0.1;
        const drunkDistort = this.currentDrunkLevel / 100 * 0.3;

        // Draw static lines
        for (let sy = 0; sy < height; sy += 3) {
            const lineAlpha = (Math.sin(sy * 0.5 + this.tvStaticFrame * 2) + 1) * 0.15 + staticIntensity * 0.1;
            this.ctx.fillStyle = `rgba(200, 200, 220, ${lineAlpha + drunkDistort * 0.2})`;
            this.ctx.fillRect(x, y + sy, width, 1);
        }

        // Random noise pixels
        const noiseCount = 100 + this.currentDrunkLevel;
        for (let i = 0; i < noiseCount; i++) {
            const seed = (i * 17 + Math.floor(this.tvStaticFrame * 3)) % 1000;
            const nx = x + (seed % width);
            const ny = y + (Math.floor(seed / width) % height);
            const brightness = 100 + ((seed * 7) % 155);
            this.ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness + 20})`;
            this.ctx.fillRect(nx, ny, 2, 2);
        }

        // Occasional "show" content - simple test card pattern
        if (Math.sin(this.time / 5000) > 0.3) {
            // Color bars (German TV test card style)
            const barWidth = width / 7;
            const barColors = ['#fff', '#ff0', '#0ff', '#0f0', '#f0f', '#f00', '#00f'];
            barColors.forEach((color, i) => {
                this.ctx.fillStyle = color;
                this.ctx.globalAlpha = 0.4;
                this.ctx.fillRect(x + i * barWidth, y + height * 0.3, barWidth, height * 0.4);
            });
            this.ctx.globalAlpha = 1;
        }

        // Scanline flicker
        if (Math.random() < 0.05 + drunkDistort * 0.1) {
            const flickerY = y + Math.random() * height;
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.fillRect(x, flickerY, width, 2);
        }

        // Screen reflection
        const reflectGrad = this.ctx.createLinearGradient(x, y, x + width, y + height);
        reflectGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
        reflectGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
        this.ctx.fillStyle = reflectGrad;
        this.ctx.fillRect(x, y, width, height);
    }

    // Draw radiator under window
    drawRadiator(x, y) {
        const width = 100;
        const height = 35;
        const ribCount = 8;
        const ribWidth = width / ribCount;

        // Radiator body
        this.ctx.fillStyle = ROOM_COLORS.RADIATOR;
        this.ctx.fillRect(x, y, width, height);

        // Ribs
        for (let i = 0; i < ribCount; i++) {
            this.ctx.fillStyle = i % 2 === 0 ? ROOM_COLORS.RADIATOR_DARK : ROOM_COLORS.RADIATOR;
            this.ctx.fillRect(x + i * ribWidth, y, ribWidth - 1, height);

            // Vertical lines for depth
            this.ctx.strokeStyle = '#606060';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x + i * ribWidth + ribWidth / 2, y + 3);
            this.ctx.lineTo(x + i * ribWidth + ribWidth / 2, y + height - 3);
            this.ctx.stroke();
        }

        // Top and bottom rails
        this.ctx.fillStyle = '#909090';
        this.ctx.fillRect(x - 5, y - 3, width + 10, 5);
        this.ctx.fillRect(x - 5, y + height - 2, width + 10, 5);
    }

    // Draw shelf with beer bottles
    drawShelfWithBottles(x, y) {
        const shelfWidth = 100;
        const shelfHeight = 10;

        // Shelf
        this.ctx.fillStyle = ROOM_COLORS.SHELF;
        this.ctx.fillRect(x, y, shelfWidth, shelfHeight);

        // Shelf edge
        this.ctx.fillStyle = this.adjustBrightness(ROOM_COLORS.SHELF, 0.7);
        this.ctx.fillRect(x, y + shelfHeight - 3, shelfWidth, 3);

        // Beer bottles on shelf
        const bottlePositions = [15, 35, 55, 75];
        bottlePositions.forEach((bx, i) => {
            const bottleColor = i % 2 === 0 ? ROOM_COLORS.BOTTLE_GREEN : ROOM_COLORS.BOTTLE_BROWN;
            const bottleHeight = 25 + (i % 3) * 5;

            // Bottle body
            this.ctx.fillStyle = bottleColor;
            this.ctx.fillRect(x + bx - 4, y - bottleHeight, 8, bottleHeight);

            // Bottle neck
            this.ctx.fillRect(x + bx - 2, y - bottleHeight - 8, 4, 10);

            // Bottle cap
            this.ctx.fillStyle = '#c0a030';
            this.ctx.fillRect(x + bx - 3, y - bottleHeight - 10, 6, 3);

            // Label
            this.ctx.fillStyle = '#f0e0c0';
            this.ctx.fillRect(x + bx - 3, y - bottleHeight + 8, 6, 8);
        });
    }

    // Draw poster/calendar on wall
    drawPoster(x, y) {
        const width = 70;
        const height = 90;

        // Poster background
        this.ctx.fillStyle = '#d0c0a0';
        this.ctx.fillRect(x, y, width, height);

        // Poster border
        this.ctx.strokeStyle = '#8a7a5a';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        // Simple "pin-up" or beer ad graphic (abstract)
        const glow = Math.sin(this.time / 600) * 0.2 + 0.8;

        // Beer mug shape
        this.ctx.fillStyle = `rgba(218, 165, 32, ${glow})`;
        this.ctx.fillRect(x + 20, y + 25, 30, 40);

        // Foam
        this.ctx.fillStyle = '#fff8dc';
        this.ctx.fillRect(x + 18, y + 20, 34, 10);

        // Handle
        this.ctx.strokeStyle = `rgba(218, 165, 32, ${glow})`;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(x + 50, y + 45, 10, -Math.PI / 2, Math.PI / 2);
        this.ctx.stroke();

        // Text "BIER"
        this.ctx.fillStyle = '#4a2a0a';
        this.ctx.font = 'bold 12px serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('BIER', x + width / 2, y + 80);

        // Pin at top
        this.ctx.fillStyle = '#cc0000';
        this.ctx.beginPath();
        this.ctx.arc(x + width / 2, y + 5, 4, 0, Math.PI * 2);
        this.ctx.fill();
    }

    // Draw lamp glow effect for night time
    drawLampGlow(colors) {
        // Warm glow from an unseen lamp
        const glowGrad = this.ctx.createRadialGradient(
            700, 150, 0,
            700, 150, 200
        );
        glowGrad.addColorStop(0, 'rgba(255, 200, 100, 0.2)');
        glowGrad.addColorStop(0.5, 'rgba(255, 180, 80, 0.1)');
        glowGrad.addColorStop(1, 'rgba(255, 150, 50, 0)');
        this.ctx.fillStyle = glowGrad;
        this.ctx.fillRect(500, 0, 300, 300);
    }

    // Draw perspective tile table (Fliesentisch)
    drawTablePerspective(colors) {
        const tableTop = ZONES.TABLE.y;
        const tableBottom = ZONES.TABLE.y + ZONES.TABLE.height;
        const tableHeight = ZONES.TABLE.height;

        // Table surface with perspective (trapezoid)
        // Top edge is narrower and further away
        const topLeft = 100;
        const topRight = this.width - 100;
        const bottomLeft = 20;
        const bottomRight = this.width - 20;

        // Draw table grout background first
        this.ctx.fillStyle = GAME_CONFIG.COLORS.TABLE_GROUT;
        this.ctx.beginPath();
        this.ctx.moveTo(topLeft, tableTop);
        this.ctx.lineTo(topRight, tableTop);
        this.ctx.lineTo(bottomRight, tableBottom);
        this.ctx.lineTo(bottomLeft, tableBottom);
        this.ctx.closePath();
        this.ctx.fill();

        // Draw tiles with perspective
        const tilesX = 12;
        const tilesY = 6;

        for (let ty = 0; ty < tilesY; ty++) {
            for (let tx = 0; tx < tilesX; tx++) {
                // Calculate perspective-adjusted tile corners
                const t1 = ty / tilesY;
                const t2 = (ty + 1) / tilesY;

                const leftEdge1 = topLeft + (bottomLeft - topLeft) * t1;
                const rightEdge1 = topRight + (bottomRight - topRight) * t1;
                const leftEdge2 = topLeft + (bottomLeft - topLeft) * t2;
                const rightEdge2 = topRight + (bottomRight - topRight) * t2;

                const y1 = tableTop + tableHeight * t1;
                const y2 = tableTop + tableHeight * t2;

                const width1 = rightEdge1 - leftEdge1;
                const width2 = rightEdge2 - leftEdge2;

                const x1 = leftEdge1 + (width1 / tilesX) * tx;
                const x2 = leftEdge1 + (width1 / tilesX) * (tx + 1);
                const x3 = leftEdge2 + (width2 / tilesX) * (tx + 1);
                const x4 = leftEdge2 + (width2 / tilesX) * tx;

                // Tile color with variation
                const seed = (tx * 7 + ty * 13) % 100;
                const brightness = 0.9 + (seed / 500);
                this.ctx.fillStyle = this.adjustBrightness(GAME_CONFIG.COLORS.TABLE_TILE, brightness);

                // Draw tile as quadrilateral
                this.ctx.beginPath();
                this.ctx.moveTo(x1 + 1, y1 + 1);
                this.ctx.lineTo(x2 - 1, y1 + 1);
                this.ctx.lineTo(x3 - 1, y2 - 1);
                this.ctx.lineTo(x4 + 1, y2 - 1);
                this.ctx.closePath();
                this.ctx.fill();
            }
        }

        // Chrome table edge/trim (left and right sides)
        this.ctx.fillStyle = '#c0c0c0';
        this.ctx.beginPath();
        this.ctx.moveTo(topLeft - 5, tableTop);
        this.ctx.lineTo(topLeft, tableTop);
        this.ctx.lineTo(bottomLeft, tableBottom);
        this.ctx.lineTo(bottomLeft - 8, tableBottom);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.moveTo(topRight + 5, tableTop);
        this.ctx.lineTo(topRight, tableTop);
        this.ctx.lineTo(bottomRight, tableBottom);
        this.ctx.lineTo(bottomRight + 8, tableBottom);
        this.ctx.closePath();
        this.ctx.fill();

        // Chrome highlight
        this.ctx.fillStyle = '#e0e0e0';
        this.ctx.beginPath();
        this.ctx.moveTo(topLeft - 3, tableTop);
        this.ctx.lineTo(topLeft - 1, tableTop);
        this.ctx.lineTo(bottomLeft - 1, tableBottom);
        this.ctx.lineTo(bottomLeft - 4, tableBottom);
        this.ctx.closePath();
        this.ctx.fill();

        // Table edge shadow at top
        const shadowGrad = this.ctx.createLinearGradient(0, tableTop, 0, tableTop + 25);
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = shadowGrad;
        this.ctx.beginPath();
        this.ctx.moveTo(topLeft, tableTop);
        this.ctx.lineTo(topRight, tableTop);
        this.ctx.lineTo(topRight - 20, tableTop + 25);
        this.ctx.lineTo(topLeft + 20, tableTop + 25);
        this.ctx.closePath();
        this.ctx.fill();

        // Matches box on table (repositioned)
        this.drawMatchBox(620, 340);
    }

    // Draw beer belly (player's body, foreground)
    drawBeerBelly(drunkLevel) {
        const bellyY = ZONES.BELLY.y;
        const bellyHeight = ZONES.BELLY.height;

        // Breathing animation
        const breathAmount = Math.sin(this.bellyBreathPhase) * 3;

        // Belly gets slightly bigger when drunk
        const drunkBulge = drunkLevel / 100 * 8;

        // T-shirt (upper portion)
        const shirtY = bellyY - 15;
        const shirtHeight = 50;

        // T-shirt gradient (gray, stained)
        const shirtGrad = this.ctx.createLinearGradient(0, shirtY, 0, shirtY + shirtHeight);
        shirtGrad.addColorStop(0, ROOM_COLORS.TSHIRT_GRAY);
        shirtGrad.addColorStop(0.3, ROOM_COLORS.TSHIRT_STAIN);
        shirtGrad.addColorStop(0.7, ROOM_COLORS.TSHIRT_GRAY);
        shirtGrad.addColorStop(1, ROOM_COLORS.TSHIRT_STAIN);
        this.ctx.fillStyle = shirtGrad;
        this.ctx.fillRect(0, shirtY, this.width, shirtHeight + breathAmount);

        // Shirt wrinkles/folds
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const wx = 150 + i * 120;
            this.ctx.beginPath();
            this.ctx.moveTo(wx, shirtY + 10);
            this.ctx.quadraticCurveTo(wx + 15, shirtY + 25 + breathAmount, wx - 10, shirtY + shirtHeight);
            this.ctx.stroke();
        }

        // Stain spots on shirt
        this.ctx.fillStyle = 'rgba(60, 50, 40, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(300, shirtY + 30, 15, 10, 0.2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.ellipse(520, shirtY + 25, 12, 8, -0.3, 0, Math.PI * 2);
        this.ctx.fill();

        // Exposed belly below shirt
        const bellyExposedY = shirtY + shirtHeight - 5;
        const bellyCurveHeight = bellyHeight - shirtHeight + 20 + drunkBulge + breathAmount;

        // Belly skin
        const skinGrad = this.ctx.createLinearGradient(0, bellyExposedY, 0, bellyExposedY + bellyCurveHeight);
        skinGrad.addColorStop(0, ROOM_COLORS.SKIN_TONE_DARK);
        skinGrad.addColorStop(0.5, ROOM_COLORS.SKIN_TONE);
        skinGrad.addColorStop(1, ROOM_COLORS.SKIN_TONE_DARK);
        this.ctx.fillStyle = skinGrad;

        // Draw belly curve
        this.ctx.beginPath();
        this.ctx.moveTo(0, bellyExposedY);
        // Curved belly shape
        this.ctx.bezierCurveTo(
            this.width * 0.25, bellyExposedY + 5,
            this.width * 0.35, bellyExposedY + bellyCurveHeight * 0.8 + drunkBulge,
            this.width * 0.5, bellyExposedY + bellyCurveHeight + drunkBulge
        );
        this.ctx.bezierCurveTo(
            this.width * 0.65, bellyExposedY + bellyCurveHeight * 0.8 + drunkBulge,
            this.width * 0.75, bellyExposedY + 5,
            this.width, bellyExposedY
        );
        this.ctx.lineTo(this.width, this.height);
        this.ctx.lineTo(0, this.height);
        this.ctx.closePath();
        this.ctx.fill();

        // Belly button
        const bellyButtonX = this.width / 2;
        const bellyButtonY = bellyExposedY + bellyCurveHeight * 0.6 + drunkBulge / 2;

        this.ctx.fillStyle = ROOM_COLORS.SKIN_TONE_DARK;
        this.ctx.beginPath();
        this.ctx.ellipse(bellyButtonX, bellyButtonY, 6, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Belly button shadow/depth
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(bellyButtonX, bellyButtonY + 2, 4, 6, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Subtle belly hair
        this.ctx.strokeStyle = 'rgba(100, 80, 60, 0.2)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 15; i++) {
            const hx = bellyButtonX - 40 + (i % 5) * 20 + Math.sin(i) * 10;
            const hy = bellyButtonY - 30 + Math.floor(i / 5) * 15;
            this.ctx.beginPath();
            this.ctx.moveTo(hx, hy);
            this.ctx.lineTo(hx + (Math.random() - 0.5) * 6, hy + 8);
            this.ctx.stroke();
        }

        // Shirt hem line (where shirt meets belly)
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, bellyExposedY - 3);
        this.ctx.bezierCurveTo(
            this.width * 0.3, bellyExposedY + 8 + breathAmount,
            this.width * 0.7, bellyExposedY + 8 + breathAmount,
            this.width, bellyExposedY - 3
        );
        this.ctx.stroke();
    }

    // Draw window showing sky with half-closed blinds
    drawWindow(x, y, colors, stars = []) {
        const width = 130;
        const height = 120;

        // Window frame (outer)
        this.ctx.fillStyle = '#2a1a0a';
        this.ctx.fillRect(x - 8, y - 8, width + 16, height + 16);

        // Window frame (inner)
        this.ctx.fillStyle = '#3a2a1a';
        this.ctx.fillRect(x - 4, y - 4, width + 8, height + 8);

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
                const sy = y + star.y * height * 0.5; // Upper portion (above blinds)
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
            this.ctx.arc(x + width - 30, y + 25, 18, 0, Math.PI * 2);
            this.ctx.fill();

            // Moon crater details
            this.ctx.fillStyle = 'rgba(200, 200, 180, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(x + width - 35, y + 22, 4, 0, Math.PI * 2);
            this.ctx.arc(x + width - 25, y + 30, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Window dividers
        this.ctx.strokeStyle = '#2a1a0a';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(x + width / 2, y);
        this.ctx.lineTo(x + width / 2, y + height);
        this.ctx.stroke();

        // Venetian blinds (half closed)
        const blindCount = 8;
        const blindHeight = 6;
        const blindGap = height / blindCount;
        const blindAngle = 0.3; // Tilted open

        this.ctx.fillStyle = '#d0c8b8';
        for (let i = 0; i < blindCount; i++) {
            const by = y + i * blindGap + blindGap * 0.6;
            // Left side blinds
            this.ctx.fillRect(x + 2, by, width / 2 - 4, blindHeight);
            // Right side blinds
            this.ctx.fillRect(x + width / 2 + 2, by, width / 2 - 4, blindHeight);

            // Blind shadow/depth
            this.ctx.fillStyle = '#b0a898';
            this.ctx.fillRect(x + 2, by + blindHeight - 1, width / 2 - 4, 1);
            this.ctx.fillRect(x + width / 2 + 2, by + blindHeight - 1, width / 2 - 4, 1);
            this.ctx.fillStyle = '#d0c8b8';
        }

        // Blind cord (right side)
        this.ctx.strokeStyle = '#a09080';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x + width - 15, y);
        this.ctx.lineTo(x + width - 15, y + height + 5);
        this.ctx.stroke();

        // Cord tassel
        this.ctx.fillStyle = '#a09080';
        this.ctx.beginPath();
        this.ctx.arc(x + width - 15, y + height + 10, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Window glow (light coming in)
        const glowGradient = this.ctx.createRadialGradient(
            x + width / 2, y + height / 2, 0,
            x + width / 2, y + height / 2, width * 1.2
        );
        const glowIntensity = colors.lampOn ? 0.05 : 0.15;
        glowGradient.addColorStop(0, `rgba(255,255,255,${glowIntensity})`);
        glowGradient.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = glowGradient;
        this.ctx.fillRect(x - 80, y - 30, width + 160, height + 80);
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

    // Draw neon-style sign (repositioned for ego perspective)
    drawNeonSign(x, y) {
        // This method is no longer used in the main render
        // Kept for compatibility but moved to poster/decoration in drawRoom
    }

    // Draw match box (perspective view)
    drawMatchBox(x, y) {
        // Box shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillRect(x + 3, y + 3, 45, 28);

        // Box outer (slightly angled for perspective)
        const boxGrad = this.ctx.createLinearGradient(x, y, x + 45, y);
        boxGrad.addColorStop(0, '#6a3510');
        boxGrad.addColorStop(0.5, '#8b4513');
        boxGrad.addColorStop(1, '#6a3510');
        this.ctx.fillStyle = boxGrad;
        this.ctx.fillRect(x, y, 45, 26);

        // Box inner slide (slightly pulled out)
        this.ctx.fillStyle = '#5a3008';
        this.ctx.fillRect(x + 2, y + 2, 41, 22);

        // Striker strip on side
        this.ctx.fillStyle = '#2a1a0a';
        this.ctx.fillRect(x + 43, y + 4, 3, 18);

        // Label
        const labelGrad = this.ctx.createLinearGradient(x + 5, y, x + 40, y);
        labelGrad.addColorStop(0, '#e0a800');
        labelGrad.addColorStop(0.5, '#ffcc00');
        labelGrad.addColorStop(1, '#e0a800');
        this.ctx.fillStyle = labelGrad;
        this.ctx.fillRect(x + 5, y + 4, 35, 18);

        // Label border
        this.ctx.strokeStyle = '#8b0000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x + 5, y + 4, 35, 18);

        // Match flame icon
        this.ctx.fillStyle = '#ff4500';
        this.ctx.beginPath();
        this.ctx.moveTo(x + 22, y + 7);
        this.ctx.quadraticCurveTo(x + 26, y + 10, x + 25, y + 15);
        this.ctx.quadraticCurveTo(x + 22, y + 18, x + 19, y + 15);
        this.ctx.quadraticCurveTo(x + 18, y + 10, x + 22, y + 7);
        this.ctx.fill();

        // Match stick
        this.ctx.fillStyle = '#deb887';
        this.ctx.fillRect(x + 21, y + 15, 3, 6);

        // Visible matches in box
        this.ctx.fillStyle = '#f0d8a0';
        for (let i = 0; i < 4; i++) {
            this.ctx.fillRect(x + 8 + i * 7, y + 22, 2, 4);
        }
        // Match heads
        this.ctx.fillStyle = '#aa2200';
        for (let i = 0; i < 4; i++) {
            this.ctx.beginPath();
            this.ctx.arc(x + 9 + i * 7, y + 22, 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    // Draw ashtray with cigarettes (perspective view)
    drawAshtray(x, y, queuedCigarettes) {
        // Ashtray shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 5, y + 8, 55, 18, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Ashtray base (glass/crystal look)
        const baseGrad = this.ctx.createRadialGradient(x - 15, y - 10, 0, x, y, 60);
        baseGrad.addColorStop(0, '#6a6a6a');
        baseGrad.addColorStop(0.5, '#4a4a4a');
        baseGrad.addColorStop(1, '#3a3a3a');
        this.ctx.fillStyle = baseGrad;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, 55, 18, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Ashtray rim highlight
        this.ctx.strokeStyle = '#7a7a7a';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, 55, 18, 0, 0, Math.PI * 2);
        this.ctx.stroke();

        // Ashtray inner depression
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y - 3, 45, 14, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Ash/debris in ashtray
        this.ctx.fillStyle = '#555';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 5, y - 3, 35, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Some ash specks
        this.ctx.fillStyle = '#666';
        for (let i = 0; i < 8; i++) {
            const ax = x - 25 + (i % 4) * 15 + Math.sin(i * 3) * 5;
            const ay = y - 8 + Math.floor(i / 4) * 6;
            this.ctx.beginPath();
            this.ctx.ellipse(ax, ay, 3 + (i % 3), 1.5, i * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Cigarette notches on rim
        this.ctx.fillStyle = '#5a5a5a';
        const notchAngles = [0.3, Math.PI - 0.3, Math.PI + 0.5];
        notchAngles.forEach(angle => {
            const nx = x + Math.cos(angle) * 50;
            const ny = y + Math.sin(angle) * 16;
            this.ctx.fillRect(nx - 8, ny - 2, 16, 4);
        });

        // Draw queued cigarettes resting in ashtray
        for (let i = 0; i < queuedCigarettes; i++) {
            const angle = (i / Math.max(queuedCigarettes, 1)) * Math.PI * 0.8 - Math.PI * 0.4;
            const cx = x + Math.cos(angle) * 28;
            const cy = y - 4 + Math.sin(angle) * 8;
            this.drawCigarette(cx, cy, angle + Math.PI / 2 + 0.2, 1, false);
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

    // Draw beer glass (Pilsner style, perspective view)
    drawBeerGlass(x, y, sipLevel) {
        const glassWidth = 35;
        const glassHeight = 60;
        const fillLevel = 0.3 + sipLevel * 0.65; // Always at least 30% visible

        // Glass shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        this.ctx.beginPath();
        this.ctx.ellipse(x + 5, y + 5, glassWidth / 2 + 3, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Glass base
        this.ctx.fillStyle = 'rgba(200, 230, 255, 0.25)';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, glassWidth / 2, 6, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Glass body (slightly tapered)
        const bodyGrad = this.ctx.createLinearGradient(x - glassWidth / 2, y, x + glassWidth / 2, y);
        bodyGrad.addColorStop(0, 'rgba(200, 230, 255, 0.2)');
        bodyGrad.addColorStop(0.3, 'rgba(220, 240, 255, 0.35)');
        bodyGrad.addColorStop(0.7, 'rgba(220, 240, 255, 0.35)');
        bodyGrad.addColorStop(1, 'rgba(200, 230, 255, 0.2)');
        this.ctx.fillStyle = bodyGrad;

        // Tapered glass shape
        this.ctx.beginPath();
        this.ctx.moveTo(x - glassWidth / 2, y);
        this.ctx.lineTo(x - glassWidth / 2 - 3, y - glassHeight);
        this.ctx.lineTo(x + glassWidth / 2 + 3, y - glassHeight);
        this.ctx.lineTo(x + glassWidth / 2, y);
        this.ctx.closePath();
        this.ctx.fill();

        // Beer liquid
        const beerHeight = glassHeight * fillLevel;
        const beerGrad = this.ctx.createLinearGradient(x, y, x, y - beerHeight);
        beerGrad.addColorStop(0, '#d4960f');
        beerGrad.addColorStop(0.5, GAME_CONFIG.COLORS.BEER_LIQUID);
        beerGrad.addColorStop(1, '#eab835');
        this.ctx.fillStyle = beerGrad;

        const beerBottomWidth = glassWidth / 2;
        const beerTopWidth = glassWidth / 2 + (beerHeight / glassHeight) * 3;
        this.ctx.beginPath();
        this.ctx.moveTo(x - beerBottomWidth + 2, y - 2);
        this.ctx.lineTo(x - beerTopWidth, y - beerHeight);
        this.ctx.lineTo(x + beerTopWidth, y - beerHeight);
        this.ctx.lineTo(x + beerBottomWidth - 2, y - 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Foam head
        const foamHeight = 8 + sipLevel * 4;
        this.ctx.fillStyle = '#fffce8';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y - beerHeight - foamHeight / 2, beerTopWidth, foamHeight / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Foam bubbles
        this.ctx.fillStyle = '#fff';
        for (let i = 0; i < 6; i++) {
            const bx = x - 12 + (i % 3) * 12;
            const by = y - beerHeight - foamHeight / 2 + Math.sin(i * 2) * 3;
            this.ctx.beginPath();
            this.ctx.arc(bx, by, 2 + (i % 2), 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Glass rim
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y - glassHeight, glassWidth / 2 + 3, 5, 0, 0, Math.PI * 2);
        this.ctx.stroke();

        // Glass highlight (reflection)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        this.ctx.beginPath();
        this.ctx.moveTo(x - glassWidth / 2 + 5, y - 5);
        this.ctx.lineTo(x - glassWidth / 2 + 2, y - glassHeight + 5);
        this.ctx.lineTo(x - glassWidth / 2 + 6, y - glassHeight + 5);
        this.ctx.lineTo(x - glassWidth / 2 + 9, y - 5);
        this.ctx.closePath();
        this.ctx.fill();

        // Condensation droplets
        this.ctx.fillStyle = 'rgba(200, 230, 255, 0.4)';
        const dropletSeed = Math.floor(this.time / 2000);
        for (let i = 0; i < 5; i++) {
            const dx = x - 10 + ((i * 7 + dropletSeed) % 20);
            const dy = y - 15 - (i * 8);
            this.ctx.beginPath();
            this.ctx.ellipse(dx, dy, 2, 3, 0, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    // Draw a hand holding something (ego perspective - closer, bigger)
    drawHand(x, y, drunkLevel) {
        const wobble = getWobbleOffset(this.time, drunkLevel, 3);
        const handX = x + wobble.x;
        const handY = y + wobble.y;

        this.ctx.save();
        this.ctx.translate(handX, handY);

        // Scale up for closer perspective
        this.ctx.scale(1.3, 1.3);

        // Hand shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(5, 20, 28, 22, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Skin tone gradient
        const skinGrad = this.ctx.createRadialGradient(0, 10, 0, 0, 15, 40);
        skinGrad.addColorStop(0, ROOM_COLORS.SKIN_TONE);
        skinGrad.addColorStop(1, ROOM_COLORS.SKIN_TONE_DARK);
        this.ctx.fillStyle = skinGrad;

        // Palm
        this.ctx.beginPath();
        this.ctx.ellipse(0, 15, 28, 22, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Wrist (coming from below - ego view)
        this.ctx.fillStyle = ROOM_COLORS.SKIN_TONE;
        this.ctx.fillRect(-20, 25, 40, 30);

        // Fingers (curled around cigarette, more natural pose)
        const fingerPositions = [
            { x: -18, y: -3, angle: -0.35, length: 24 },
            { x: -10, y: -12, angle: -0.2, length: 28 },
            { x: 0, y: -16, angle: 0, length: 30 },
            { x: 10, y: -12, angle: 0.2, length: 26 }
        ];

        fingerPositions.forEach((f, idx) => {
            this.ctx.save();
            this.ctx.translate(f.x, f.y);
            this.ctx.rotate(f.angle);

            // Finger gradient
            const fingerGrad = this.ctx.createLinearGradient(-5, 0, 5, 0);
            fingerGrad.addColorStop(0, ROOM_COLORS.SKIN_TONE_DARK);
            fingerGrad.addColorStop(0.5, ROOM_COLORS.SKIN_TONE);
            fingerGrad.addColorStop(1, ROOM_COLORS.SKIN_TONE_DARK);
            this.ctx.fillStyle = fingerGrad;

            // Finger body
            this.ctx.fillRect(-5, -f.length, 10, f.length + 2);

            // Fingertip
            this.ctx.beginPath();
            this.ctx.arc(0, -f.length, 5, 0, Math.PI * 2);
            this.ctx.fill();

            // Knuckle line
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(-4, -f.length * 0.4);
            this.ctx.lineTo(4, -f.length * 0.4);
            this.ctx.stroke();

            // Fingernail
            this.ctx.fillStyle = '#f0d8c8';
            this.ctx.beginPath();
            this.ctx.ellipse(0, -f.length - 2, 3, 4, 0, Math.PI, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        });

        // Thumb (more prominent)
        this.ctx.save();
        this.ctx.translate(22, 3);
        this.ctx.rotate(0.6);

        const thumbGrad = this.ctx.createLinearGradient(-5, 0, 7, 0);
        thumbGrad.addColorStop(0, ROOM_COLORS.SKIN_TONE_DARK);
        thumbGrad.addColorStop(0.5, ROOM_COLORS.SKIN_TONE);
        thumbGrad.addColorStop(1, ROOM_COLORS.SKIN_TONE_DARK);
        this.ctx.fillStyle = thumbGrad;

        this.ctx.fillRect(-5, -18, 12, 22);
        this.ctx.beginPath();
        this.ctx.arc(1, -18, 6, 0, Math.PI * 2);
        this.ctx.fill();

        // Thumbnail
        this.ctx.fillStyle = '#f0d8c8';
        this.ctx.beginPath();
        this.ctx.ellipse(1, -20, 4, 5, 0, Math.PI, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();

        this.ctx.restore();
    }

    // Draw current cigarette being smoked (ego perspective - in hand)
    drawCurrentCigarette(x, y, capacity, isSmoking, drunkLevel) {
        // Hand wobble when drunk
        const wobble = getWobbleOffset(this.time, drunkLevel, 3);

        // Draw hand first (positioned for ego view - coming from lower right)
        this.drawHand(x - 30, y + 20, drunkLevel);

        // Cigarette positioned between fingers
        this.drawCigarette(
            x + wobble.x,
            y + wobble.y - 8,
            -0.25 + Math.sin(this.time / 1000) * 0.04,
            capacity / GAME_CONFIG.CIGARETTE_CAPACITY,
            true
        );

        // Add smoke (rising up from ego view)
        if (isSmoking) {
            for (let i = 0; i < 4; i++) {
                this.addSmokeParticle(x + 40 + wobble.x + (Math.random() - 0.5) * 10, y - 15 + wobble.y);
            }
        } else {
            // Idle smoke trail
            if (Math.random() < 0.15) {
                this.addSmokeParticle(x + 38 + wobble.x, y - 12 + wobble.y);
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
    drawHUD(player, difficulty = null) {
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

        // Gaming mode: Draw gear indicator
        if (difficulty && difficulty.isGamingMode()) {
            this.drawGearIndicator(
                difficulty.getLevel(),
                difficulty.getLevelName(),
                difficulty.getScoreMultiplier()
            );
        }

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

        // Control hints (bottom) - different for each mode
        this.ctx.font = '12px monospace';
        this.ctx.fillStyle = '#888';
        this.ctx.textAlign = 'center';
        if (difficulty && difficulty.isGamingMode()) {
            this.ctx.fillText('[SPACE] Smoke  |  [B] Drink  |  [WASD] Stuff  |  GAMING MODE', this.width / 2, this.height - 15);
        } else {
            this.ctx.fillText('[SPACE] Smoke  |  [B] Drink Beer  |  [WASD] Stuff Cigarettes', this.width / 2, this.height - 15);
        }
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

    // Blend two hex colors together
    blendColors(color1, color2, ratio) {
        // Parse colors to RGB
        const parse = (c) => {
            if (c.startsWith('rgb')) {
                const match = c.match(/\d+/g);
                return match ? { r: parseInt(match[0]), g: parseInt(match[1]), b: parseInt(match[2]) } : { r: 0, g: 0, b: 0 };
            }
            if (c.startsWith('#')) {
                return {
                    r: parseInt(c.slice(1, 3), 16),
                    g: parseInt(c.slice(3, 5), 16),
                    b: parseInt(c.slice(5, 7), 16)
                };
            }
            return { r: 0, g: 0, b: 0 };
        };

        const c1 = parse(color1);
        const c2 = parse(color2);

        const r = Math.round(c1.r * (1 - ratio) + c2.r * ratio);
        const g = Math.round(c1.g * (1 - ratio) + c2.g * ratio);
        const b = Math.round(c1.b * (1 - ratio) + c2.b * ratio);

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

    // Draw mode selection screen
    drawModeSelect() {
        this.clear();

        // Title
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 36px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SELECT MODE', this.width / 2, 120);

        // Hartz IV Mode box
        const boxWidth = 320;
        const boxHeight = 180;
        const harzX = this.width / 2 - boxWidth - 20;
        const gamingX = this.width / 2 + 20;
        const boxY = 180;

        // Hartz IV Mode
        this.ctx.fillStyle = 'rgba(80, 60, 40, 0.8)';
        this.ctx.fillRect(harzX, boxY, boxWidth, boxHeight);
        this.ctx.strokeStyle = '#c9a959';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(harzX, boxY, boxWidth, boxHeight);

        this.ctx.fillStyle = '#c9a959';
        this.ctx.font = 'bold 24px monospace';
        this.ctx.fillText('HARTZ IV', harzX + boxWidth / 2, boxY + 40);

        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '14px monospace';
        this.ctx.fillText('Chill & Survive', harzX + boxWidth / 2, boxY + 70);

        this.ctx.fillStyle = '#888';
        this.ctx.font = '12px monospace';
        const harzLines = [
            '• Relaxed pace',
            '• Drunk chaos effects',
            '• Random key scrambling',
            '• Control inversions',
            '• Play forever (if skilled)'
        ];
        harzLines.forEach((line, i) => {
            this.ctx.textAlign = 'left';
            this.ctx.fillText(line, harzX + 20, boxY + 100 + i * 16);
        });

        this.ctx.fillStyle = '#ffcc00';
        this.ctx.font = 'bold 16px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('[H] to Select', harzX + boxWidth / 2, boxY + boxHeight - 15);

        // Gaming Mode
        this.ctx.fillStyle = 'rgba(40, 40, 80, 0.8)';
        this.ctx.fillRect(gamingX, boxY, boxWidth, boxHeight);
        this.ctx.strokeStyle = '#ff4444';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(gamingX, boxY, boxWidth, boxHeight);

        this.ctx.fillStyle = '#ff4444';
        this.ctx.font = 'bold 24px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAMING', gamingX + boxWidth / 2, boxY + 40);

        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '14px monospace';
        this.ctx.fillText('Arcade Racing', gamingX + boxWidth / 2, boxY + 70);

        this.ctx.fillStyle = '#888';
        this.ctx.font = '12px monospace';
        const gamingLines = [
            '• Progressive difficulty',
            '• No RNG - pure skill',
            '• Music speeds up',
            '• Higher score multipliers',
            '• How fast can you go?'
        ];
        gamingLines.forEach((line, i) => {
            this.ctx.textAlign = 'left';
            this.ctx.fillText(line, gamingX + 20, boxY + 100 + i * 16);
        });

        this.ctx.fillStyle = '#ff4444';
        this.ctx.font = 'bold 16px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('[G] to Select', gamingX + boxWidth / 2, boxY + boxHeight - 15);

        // Back hint
        this.ctx.fillStyle = '#666';
        this.ctx.font = '12px monospace';
        this.ctx.fillText('[ESC] Back to Menu', this.width / 2, this.height - 40);

        this.drawCRTEffect();
    }

    // Draw speed lines for Gaming mode
    drawSpeedLines(intensity) {
        if (intensity <= 0) return;

        const lineCount = Math.floor(intensity * 20) + 5;
        const maxLength = 50 + intensity * 100;

        this.ctx.strokeStyle = `rgba(255, 255, 255, ${intensity * 0.3})`;
        this.ctx.lineWidth = 2;

        for (let i = 0; i < lineCount; i++) {
            // Seed based on index for stable positioning
            const seed = (i * 1234.5678) % 1;
            const side = i % 2; // Alternate sides

            let x, y;
            if (side === 0) {
                // Left side
                x = 20 + seed * 60;
            } else {
                // Right side
                x = this.width - 20 - seed * 60;
            }

            // Y position with animation
            const baseY = (i / lineCount) * this.height;
            y = (baseY + this.speedLineOffset * (1 + intensity)) % this.height;

            const lineLength = maxLength * (0.5 + seed * 0.5);

            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x, y + lineLength);
            this.ctx.stroke();
        }
    }

    // Draw level-up flash effect
    drawLevelUpFlash() {
        if (this.levelUpFlashTimer <= 0) return;

        const progress = this.levelUpFlashTimer / 500;
        const alpha = progress * 0.4;

        this.ctx.fillStyle = `rgba(255, 255, 100, ${alpha})`;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Show "LEVEL UP!" text during flash
        if (progress > 0.3) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${progress})`;
            this.ctx.font = 'bold 48px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GEAR UP!', this.width / 2, this.height / 2 - 50);
        }
    }

    // Draw gear indicator for Gaming mode
    drawGearIndicator(level, levelName, scoreMultiplier) {
        const x = this.width - 100;
        const y = 100;

        // Gear box background
        this.ctx.fillStyle = 'rgba(40, 40, 60, 0.9)';
        this.ctx.fillRect(x - 40, y - 30, 80, 70);

        // Border color based on level
        const colors = ['#888', '#88ff88', '#ffff88', '#ff8844', '#ff4444'];
        this.ctx.strokeStyle = colors[level - 1] || '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x - 40, y - 30, 80, 70);

        // Gear number
        this.ctx.fillStyle = colors[level - 1] || '#fff';
        this.ctx.font = 'bold 32px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(levelName, x, y + 5);

        // "GEAR" label
        this.ctx.fillStyle = '#888';
        this.ctx.font = '10px monospace';
        this.ctx.fillText('GEAR', x, y - 18);

        // Score multiplier
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.font = 'bold 12px monospace';
        this.ctx.fillText(`x${scoreMultiplier.toFixed(1)}`, x, y + 28);
    }
}
