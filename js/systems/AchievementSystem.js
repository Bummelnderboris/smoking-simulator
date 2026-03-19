// Achievement System - Track and unlock achievements

const ACHIEVEMENTS = {
    FIRST_TIMER: {
        id: 'first_timer',
        name: 'First Timer',
        description: 'Complete your first game',
        icon: '🎮'
    },
    MINUTE_MAN: {
        id: 'minute_man',
        name: 'Minute Man',
        description: 'Survive for 1 minute',
        icon: '⏱️'
    },
    FIVE_OCLOCK: {
        id: 'five_oclock',
        name: "Five O'Clock Somewhere",
        description: 'Survive for 5 minutes',
        icon: '🕐'
    },
    NIGHT_OWL: {
        id: 'night_owl',
        name: 'Night Owl',
        description: 'Survive for 10 minutes',
        icon: '🦉'
    },
    CHAIN_SMOKER: {
        id: 'chain_smoker',
        name: 'Chain Smoker',
        description: 'Smoke 10 cigarettes in one game',
        icon: '🚬'
    },
    PACK_A_DAY: {
        id: 'pack_a_day',
        name: 'Pack a Day',
        description: 'Smoke 20 cigarettes in one game',
        icon: '📦'
    },
    ROLLING_PRO: {
        id: 'rolling_pro',
        name: 'Rolling Pro',
        description: 'Successfully stuff 15 cigarettes',
        icon: '👍'
    },
    BUTTERFINGERS: {
        id: 'butterfingers',
        name: 'Butterfingers',
        description: 'Fail 5 stuffing attempts in one game',
        icon: '🧈'
    },
    FUNCTIONAL: {
        id: 'functional',
        name: 'Functional Alcoholic',
        description: 'Reach 100% drunk and survive 30 more seconds',
        icon: '🍺'
    },
    HEAVYWEIGHT: {
        id: 'heavyweight',
        name: 'Heavyweight Champion',
        description: 'Stay above 90% drunk for 60 seconds total',
        icon: '🏋️'
    },
    CLOSE_CALL: {
        id: 'close_call',
        name: 'Close Call',
        description: 'Hit 95% oxygen and live to tell the tale',
        icon: '😰'
    },
    ZEN_MASTER: {
        id: 'zen_master',
        name: 'Zen Master',
        description: 'Score 10,000 points',
        icon: '🧘'
    },
    SPEED_ROLLER: {
        id: 'speed_roller',
        name: 'Speed Roller',
        description: 'Stuff a cigarette in under 2 seconds',
        icon: '⚡'
    },
    IRON_LUNGS: {
        id: 'iron_lungs',
        name: 'Iron Lungs',
        description: 'Smoke 5 cigarettes without drinking',
        icon: '💨'
    }
};

export class AchievementSystem {
    constructor() {
        this.unlocked = new Set();
        this.pendingNotifications = [];
        this.sessionStats = {};
        this.load();
        this.resetSession();
    }

    resetSession() {
        this.sessionStats = {
            stuffSuccess: 0,
            stuffFails: 0,
            cigarettesSmoked: 0,
            cigarettesSmokedWithoutDrink: 0,
            timeAt100Drunk: 0,
            timeAbove90Drunk: 0,
            reachedMaxDrunk: false,
            survivedAfterMaxDrunk: 0,
            maxOxygenReached: 0,
            hit95Oxygen: false,
            survived95Oxygen: false,
            fastestStuff: Infinity,
            lastDrinkTime: 0
        };
    }

    load() {
        try {
            const saved = localStorage.getItem('smokingSimAchievements');
            if (saved) {
                const arr = JSON.parse(saved);
                this.unlocked = new Set(arr);
            }
        } catch (e) {
            console.warn('Could not load achievements');
        }
    }

    save() {
        try {
            const arr = Array.from(this.unlocked);
            localStorage.setItem('smokingSimAchievements', JSON.stringify(arr));
        } catch (e) {
            console.warn('Could not save achievements');
        }
    }

    unlock(achievementKey) {
        const achievement = ACHIEVEMENTS[achievementKey];
        if (!achievement) return false;

        if (!this.unlocked.has(achievement.id)) {
            this.unlocked.add(achievement.id);
            this.pendingNotifications.push(achievement);
            this.save();
            console.log(`Achievement unlocked: ${achievement.name}`);
            return true;
        }
        return false;
    }

    isUnlocked(achievementKey) {
        const achievement = ACHIEVEMENTS[achievementKey];
        return achievement && this.unlocked.has(achievement.id);
    }

    getNextNotification() {
        return this.pendingNotifications.shift();
    }

    hasNotifications() {
        return this.pendingNotifications.length > 0;
    }

    // Update stats and check achievements
    update(player, deltaTime) {
        const dt = deltaTime / 1000;

        // Track drunk time
        if (player.drunkenness >= 100) {
            this.sessionStats.reachedMaxDrunk = true;
            this.sessionStats.timeAt100Drunk += dt;
        }

        if (this.sessionStats.reachedMaxDrunk && player.drunkenness < 100) {
            this.sessionStats.survivedAfterMaxDrunk += dt;
        }

        if (player.drunkenness >= 90) {
            this.sessionStats.timeAbove90Drunk += dt;
        }

        // Track oxygen
        if (player.oxygen > this.sessionStats.maxOxygenReached) {
            this.sessionStats.maxOxygenReached = player.oxygen;
        }

        // Track if player hit 95%+ oxygen and then recovered (went back below 95)
        if (player.oxygen >= 95) {
            this.sessionStats.hit95Oxygen = true;
        }

        // If they hit 95%+ and then got back below 90%, they truly survived it
        if (this.sessionStats.hit95Oxygen && player.oxygen < 90) {
            this.sessionStats.survived95Oxygen = true;
        }

        // Check time-based achievements
        if (player.timeAlive >= 60) {
            this.unlock('MINUTE_MAN');
        }
        if (player.timeAlive >= 300) {
            this.unlock('FIVE_OCLOCK');
        }
        if (player.timeAlive >= 600) {
            this.unlock('NIGHT_OWL');
        }

        // Check score achievement
        if (player.score >= 10000) {
            this.unlock('ZEN_MASTER');
        }

        // Check drunk achievements
        if (this.sessionStats.survivedAfterMaxDrunk >= 30) {
            this.unlock('FUNCTIONAL');
        }
        if (this.sessionStats.timeAbove90Drunk >= 60) {
            this.unlock('HEAVYWEIGHT');
        }
    }

    // Called when player smokes
    onSmoke(player) {
        this.sessionStats.cigarettesSmoked++;
        this.sessionStats.cigarettesSmokedWithoutDrink++;

        if (this.sessionStats.cigarettesSmoked >= 10) {
            this.unlock('CHAIN_SMOKER');
        }
        if (this.sessionStats.cigarettesSmoked >= 20) {
            this.unlock('PACK_A_DAY');
        }
        if (this.sessionStats.cigarettesSmokedWithoutDrink >= 5) {
            this.unlock('IRON_LUNGS');
        }
    }

    // Called when player drinks
    onDrink() {
        this.sessionStats.cigarettesSmokedWithoutDrink = 0;
        this.sessionStats.lastDrinkTime = performance.now();
    }

    // Called when stuffing succeeds
    onStuffSuccess(duration) {
        this.sessionStats.stuffSuccess++;

        if (duration < this.sessionStats.fastestStuff) {
            this.sessionStats.fastestStuff = duration;
        }

        if (this.sessionStats.stuffSuccess >= 15) {
            this.unlock('ROLLING_PRO');
        }
        if (duration < 2000) {
            this.unlock('SPEED_ROLLER');
        }
    }

    // Called when stuffing fails
    onStuffFail() {
        this.sessionStats.stuffFails++;

        if (this.sessionStats.stuffFails >= 5) {
            this.unlock('BUTTERFINGERS');
        }
    }

    // Called when game ends
    onGameOver(player) {
        this.unlock('FIRST_TIMER');

        if (this.sessionStats.survived95Oxygen) {
            this.unlock('CLOSE_CALL');
        }
    }

    // Get all achievements for display
    getAllAchievements() {
        return Object.values(ACHIEVEMENTS).map(a => ({
            ...a,
            unlocked: this.unlocked.has(a.id)
        }));
    }

    getUnlockedCount() {
        return this.unlocked.size;
    }

    getTotalCount() {
        return Object.keys(ACHIEVEMENTS).length;
    }
}

export { ACHIEVEMENTS };
