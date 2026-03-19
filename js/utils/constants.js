// Game balance constants - easy to tune
export const GAME_CONFIG = {
    // Canvas
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,

    // Oxygen system (0-100, higher = worse)
    OXYGEN_MAX: 100,
    OXYGEN_FILL_RATE: 8,        // Per second when not smoking
    OXYGEN_DRAIN_RATE: 25,      // Per smoke action
    OXYGEN_DANGER_THRESHOLD: 70,

    // Cigarette system
    CIGARETTE_CAPACITY: 100,     // How much "smoke" in one cigarette
    SMOKE_CONSUMPTION: 15,       // How much consumed per puff
    MAX_QUEUED_CIGARETTES: 5,
    STARTING_CIGARETTES: 2,

    // Stuffing mini-game
    STUFFING_SEQUENCE_LENGTH: 4, // Keys to press
    STUFFING_TIME_LIMIT: 8000,   // Ms to complete stuffing

    // Drowsiness system (0-100, higher = sleepier)
    DROWSINESS_MAX: 100,
    DROWSINESS_FILL_RATE: 3,     // Per second
    DROWSINESS_DRAIN_PER_SIP: 30,
    DROWSINESS_DANGER_THRESHOLD: 70,

    // Drunkenness system (0-100)
    DRUNKENNESS_MAX: 100,
    DRUNKENNESS_PER_SIP: 8,
    DRUNKENNESS_DECAY_RATE: 0.5, // Per second (very slow)

    // Drunk effect thresholds
    DRUNK_LEVEL_1: 25,  // Slight wobble
    DRUNK_LEVEL_2: 50,  // Input delay
    DRUNK_LEVEL_3: 75,  // Chaos mode

    // Input
    INPUT_DELAY_BASE: 0,         // Ms
    INPUT_DELAY_DRUNK_MULT: 3,   // Ms per drunk %

    // Scoring
    POINTS_PER_SECOND: 10,
    POINTS_PER_CIGARETTE: 100,
    POINTS_PER_BEER: 50,

    // Visual
    SMOKE_PARTICLE_COUNT: 15,
    CRT_SCANLINE_OPACITY: 0.1,
    WOBBLE_INTENSITY: 0.5,       // Pixels per drunk %

    // Colors (80s palette)
    COLORS: {
        BACKGROUND: '#1a1a2e',
        TABLE_TILE: '#c9a959',
        TABLE_GROUT: '#8b7355',
        CIGARETTE_PAPER: '#f5f5dc',
        CIGARETTE_FILTER: '#d2691e',
        CIGARETTE_EMBER: '#ff4500',
        BEER_GLASS: '#87ceeb',
        BEER_LIQUID: '#daa520',
        SMOKE: '#cccccc',
        UI_BG: '#2d2d44',
        UI_BORDER: '#4a4a6a',
        METER_DANGER: '#ff4444',
        METER_WARNING: '#ffaa00',
        METER_OK: '#44ff44',
        TEXT: '#ffffff',
        TEXT_SHADOW: '#000000'
    }
};

// Key bindings
export const KEYS = {
    SMOKE: ' ',           // Spacebar
    DRINK: 'b',
    STUFF_KEYS: ['w', 'a', 's', 'd'], // For stuffing sequence
    START: 'Enter',
    PAUSE: 'Escape'
};

// Game states
export const GAME_STATES = {
    MENU: 'menu',
    PLAYING: 'playing',
    STUFFING: 'stuffing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over'
};

// Death causes
export const DEATH_CAUSES = {
    OXYGEN: 'You overdosed on oxygen! Should have smoked more...',
    DROWSINESS: 'You fell asleep at the table. Lightweight.',
    NO_CIGARETTES: 'No cigarettes left! You panicked and inhaled pure air.',
    FIRE: 'You set the table on fire. Classic.'
};
