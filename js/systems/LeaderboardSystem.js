// Leaderboard System - Local leaderboard with simulated players

// Funny player names for the simulated leaderboard
const FAKE_NAMES = [
    'SmokyMcSmokeFace',
    'LungDestroyer99',
    'CigaretteKing',
    'AshTrayHero',
    'NicotineNinja',
    'PuffDaddy420',
    'ChainMaster',
    'TobaccoTitan',
    'FilterFiend',
    'EmberEmperor',
    'MarlboroMan',
    'CamelJockey',
    'LuckyStrike',
    'WinstonWolf',
    'NewportNews',
    'BeerAndSmokes',
    'BarFly2000',
    'HappyHour247',
    'LastCallLarry',
    'TileTableTerry',
    'RetroSmoker',
    '80sKid',
    'VintageVibes',
    'OldSchoolCool',
    'GrandpasHabit',
    'CoughingCarl',
    'WheezyWilson',
    'BreathlessBarry',
    'TarLungs',
    'YellowFingers'
];

export class LeaderboardSystem {
    constructor() {
        this.entries = [];
        this.playerName = 'PLAYER';
        this.maxEntries = 10;
        this.load();
        this.loadPlayerName();
    }

    loadPlayerName() {
        try {
            const saved = localStorage.getItem('smokingSimPlayerName');
            if (saved) {
                this.playerName = saved;
            }
        } catch (e) {
            // Use default
        }
    }

    savePlayerName() {
        try {
            localStorage.setItem('smokingSimPlayerName', this.playerName);
        } catch (e) {
            console.warn('Could not save player name');
        }
    }

    setPlayerName(name) {
        // Sanitize and limit name
        const sanitized = name.trim().toUpperCase().slice(0, 12);
        if (sanitized.length > 0) {
            this.playerName = sanitized;
            this.savePlayerName();
            // Update existing player entries with new name
            this.entries.forEach(e => {
                if (e.isPlayer) {
                    e.name = this.playerName;
                }
            });
            this.save();
        }
    }

    getPlayerName() {
        return this.playerName;
    }

    load() {
        try {
            const saved = localStorage.getItem('smokingSimLeaderboard');
            if (saved) {
                this.entries = JSON.parse(saved);
            } else {
                // Initialize with some fake scores
                this.generateInitialLeaderboard();
            }
        } catch (e) {
            this.generateInitialLeaderboard();
        }
    }

    save() {
        try {
            localStorage.setItem('smokingSimLeaderboard', JSON.stringify(this.entries));
        } catch (e) {
            console.warn('Could not save leaderboard');
        }
    }

    generateInitialLeaderboard() {
        // Create believable starting leaderboard
        const baseScores = [8500, 6200, 4800, 3500, 2800, 2100, 1500, 900, 500, 200];

        this.entries = baseScores.map((score, i) => {
            const variance = Math.floor(score * 0.2 * (Math.random() - 0.5));
            return {
                name: this.getRandomName(),
                score: score + variance,
                time: Math.floor((score / 10) * (0.8 + Math.random() * 0.4)),
                cigarettes: Math.floor(score / 500) + Math.floor(Math.random() * 3),
                isPlayer: false,
                date: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000 // Random time in last week
            };
        });

        this.entries.sort((a, b) => b.score - a.score);
        this.save();
    }

    getRandomName() {
        const usedNames = this.entries.map(e => e.name);
        const available = FAKE_NAMES.filter(n => !usedNames.includes(n));
        if (available.length === 0) {
            return FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)] + Math.floor(Math.random() * 99);
        }
        return available[Math.floor(Math.random() * available.length)];
    }

    // Record a game result (always called, even if score doesn't make leaderboard)
    recordGame(score, time, cigarettes) {
        // Maybe add fake competitors based on player's score (keeps leaderboard dynamic)
        if (Math.random() < 0.25) {
            this.addFakeCompetitor(score);
        }
        this.save();
        return this.getRank(score);
    }

    // Submit a new score to the leaderboard (only called when score qualifies)
    submitScore(score, time, cigarettes) {
        // Remove old player entries (keep only best)
        const playerBest = this.entries.find(e => e.isPlayer);
        if (playerBest && score <= playerBest.score) {
            // Not a new personal best, but still show rank
            return this.getRank(score);
        }

        // Remove old player entry if exists
        this.entries = this.entries.filter(e => !e.isPlayer);

        // Add new entry
        const newEntry = {
            name: this.playerName,
            score: Math.floor(score),
            time: Math.floor(time),
            cigarettes: cigarettes,
            isPlayer: true,
            date: Date.now()
        };

        this.entries.push(newEntry);
        this.entries.sort((a, b) => b.score - a.score);

        // Keep only top entries
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(0, this.maxEntries);
        }

        // Maybe add some new fake competitors occasionally
        if (Math.random() < 0.3) {
            this.addFakeCompetitor(score);
        }

        this.save();
        return this.getRank(score);
    }

    // Add a fake competitor near the player's score
    addFakeCompetitor(playerScore) {
        // Generate score close to player's
        const variance = playerScore * 0.3;
        const fakeScore = Math.floor(playerScore + (Math.random() - 0.5) * variance);

        if (fakeScore < 100) return;

        const newFake = {
            name: this.getRandomName(),
            score: fakeScore,
            time: Math.floor((fakeScore / 10) * (0.8 + Math.random() * 0.4)),
            cigarettes: Math.floor(fakeScore / 500) + Math.floor(Math.random() * 3),
            isPlayer: false,
            date: Date.now() - Math.random() * 60 * 60 * 1000 // Within last hour
        };

        this.entries.push(newFake);
        this.entries.sort((a, b) => b.score - a.score);

        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(0, this.maxEntries);
        }
    }

    getRank(score) {
        const sorted = [...this.entries].sort((a, b) => b.score - a.score);
        for (let i = 0; i < sorted.length; i++) {
            if (score >= sorted[i].score) {
                return i + 1;
            }
        }
        return sorted.length + 1;
    }

    getTopEntries(count = 10) {
        return this.entries.slice(0, count);
    }

    getPlayerBest() {
        return this.entries.find(e => e.isPlayer);
    }

    isOnLeaderboard(score) {
        if (this.entries.length < this.maxEntries) return true;
        return score > this.entries[this.entries.length - 1].score;
    }

    // Format time for display
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Get relative time string
    getRelativeTime(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    }
}
