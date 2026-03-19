// Day/Night Cycle System
// Time progresses as you survive longer

export const TIME_PHASES = {
    MORNING: 'morning',
    MIDDAY: 'midday',
    EVENING: 'evening',
    NIGHT: 'night'
};

// Color palettes for each time of day
export const TIME_COLORS = {
    morning: {
        sky: '#ffb347',      // Warm orange sunrise
        skyGradient: '#ff7f50',
        wall: '#5a4738',
        wallAccent: '#4a3728',
        ambient: 'rgba(255, 200, 100, 0.1)',
        windowGlow: '#ffd700',
        lampOn: false
    },
    midday: {
        sky: '#87ceeb',      // Bright blue
        skyGradient: '#b0e0e6',
        wall: '#4a3728',
        wallAccent: '#3d2d1f',
        ambient: 'rgba(255, 255, 255, 0.05)',
        windowGlow: '#ffffff',
        lampOn: false
    },
    evening: {
        sky: '#ff6b35',      // Orange/red sunset
        skyGradient: '#c41e3a',
        wall: '#3d2518',
        wallAccent: '#2d1a10',
        ambient: 'rgba(255, 100, 50, 0.15)',
        windowGlow: '#ff4500',
        lampOn: false
    },
    night: {
        sky: '#1a1a3e',      // Dark blue night
        skyGradient: '#0d0d2b',
        wall: '#2a1a10',
        wallAccent: '#1a1008',
        ambient: 'rgba(50, 50, 100, 0.2)',
        windowGlow: '#4169e1',
        lampOn: true,
        stars: true
    }
};

// Transition thresholds (in seconds)
const PHASE_TIMES = {
    MORNING_END: 120,    // 0-2 minutes
    MIDDAY_END: 300,     // 2-5 minutes
    EVENING_END: 480,    // 5-8 minutes
    // Night: 8+ minutes
};

export class DayNightSystem {
    constructor() {
        this.currentPhase = TIME_PHASES.MORNING;
        this.transitionProgress = 0; // 0-1 for smooth transitions
        this.stars = this.generateStars();
    }

    generateStars() {
        const stars = [];
        for (let i = 0; i < 30; i++) {
            stars.push({
                x: Math.random(),
                y: Math.random(),
                size: 1 + Math.random() * 2,
                twinkleSpeed: 0.5 + Math.random() * 2,
                twinkleOffset: Math.random() * Math.PI * 2
            });
        }
        return stars;
    }

    update(timeAlive) {
        let newPhase;
        let phaseProgress;

        if (timeAlive < PHASE_TIMES.MORNING_END) {
            newPhase = TIME_PHASES.MORNING;
            phaseProgress = timeAlive / PHASE_TIMES.MORNING_END;
        } else if (timeAlive < PHASE_TIMES.MIDDAY_END) {
            newPhase = TIME_PHASES.MIDDAY;
            phaseProgress = (timeAlive - PHASE_TIMES.MORNING_END) /
                           (PHASE_TIMES.MIDDAY_END - PHASE_TIMES.MORNING_END);
        } else if (timeAlive < PHASE_TIMES.EVENING_END) {
            newPhase = TIME_PHASES.EVENING;
            phaseProgress = (timeAlive - PHASE_TIMES.MIDDAY_END) /
                           (PHASE_TIMES.EVENING_END - PHASE_TIMES.MIDDAY_END);
        } else {
            newPhase = TIME_PHASES.NIGHT;
            phaseProgress = Math.min(1, (timeAlive - PHASE_TIMES.EVENING_END) / 120);
        }

        this.currentPhase = newPhase;
        this.transitionProgress = phaseProgress;
    }

    getCurrentColors() {
        return TIME_COLORS[this.currentPhase];
    }

    getNextPhase() {
        switch (this.currentPhase) {
            case TIME_PHASES.MORNING: return TIME_PHASES.MIDDAY;
            case TIME_PHASES.MIDDAY: return TIME_PHASES.EVENING;
            case TIME_PHASES.EVENING: return TIME_PHASES.NIGHT;
            default: return TIME_PHASES.NIGHT;
        }
    }

    // Interpolate between current and next phase colors
    getInterpolatedColors() {
        const current = TIME_COLORS[this.currentPhase];
        const next = TIME_COLORS[this.getNextPhase()];

        // For simplicity, use current colors with slight blending near transitions
        if (this.transitionProgress > 0.7) {
            const blend = (this.transitionProgress - 0.7) / 0.3;
            return {
                ...current,
                transitionBlend: blend
            };
        }

        return { ...current, transitionBlend: 0 };
    }

    getPhaseDisplayName() {
        switch (this.currentPhase) {
            case TIME_PHASES.MORNING: return 'Morning';
            case TIME_PHASES.MIDDAY: return 'Midday';
            case TIME_PHASES.EVENING: return 'Evening';
            case TIME_PHASES.NIGHT: return 'Night';
            default: return '';
        }
    }

    isNight() {
        return this.currentPhase === TIME_PHASES.NIGHT;
    }

    shouldShowStars() {
        return this.currentPhase === TIME_PHASES.NIGHT ||
               (this.currentPhase === TIME_PHASES.EVENING && this.transitionProgress > 0.8);
    }

    getStars() {
        return this.stars;
    }
}
