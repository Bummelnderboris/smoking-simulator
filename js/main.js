import { Game } from './game/Game.js';
import { GAME_CONFIG } from './utils/constants.js';

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Smoking Simulator - Tile Table Edition (1987)');
    console.log('Initializing...');

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

    console.log('Game started!');

    // Handle window resize
    window.addEventListener('resize', () => {
        // Keep canvas centered - handled by CSS
    });

    // Prevent right-click context menu on canvas
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Debug info
    if (window.location.hash === '#debug') {
        window.game = game;
        console.log('Debug mode enabled. Access game via window.game');
    }
});
