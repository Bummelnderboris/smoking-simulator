import { Game } from './game/Game.js';
import { GAME_CONFIG } from './utils/constants.js';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
    // Get canvas
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }

    // Set canvas size
    canvas.width = GAME_CONFIG.CANVAS_WIDTH;
    canvas.height = GAME_CONFIG.CANVAS_HEIGHT;

    // Create and initialize game
    const game = new Game(canvas);
    await game.init();

    // Start game loop
    game.start();

    // Handle window resize
    window.addEventListener('resize', () => {
        // Keep canvas centered - handled by CSS
    });

    // Prevent right-click context menu on canvas
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Debug mode - access game via window.game with #debug hash
    if (window.location.hash === '#debug') {
        window.game = game;
    }
});
