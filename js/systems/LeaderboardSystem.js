// Leaderboard System - Firebase-powered global leaderboard
import { database, ref, push, get, query, orderByChild, limitToLast, onValue } from '../firebase-config.js';

export class LeaderboardSystem {
    constructor() {
        this.entries = [];
        this.playerName = 'PLAYER';
        this.maxEntries = 10;
        this.isLoading = true;
        this.lastError = null;

        // Local player name from localStorage
        this.loadPlayerName();

        // Load leaderboard from Firebase
        this.setupRealtimeListener();
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
        const sanitized = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        if (sanitized.length > 0) {
            this.playerName = sanitized;
            this.savePlayerName();
        }
    }

    getPlayerName() {
        return this.playerName;
    }

    // Setup realtime listener for leaderboard updates
    setupRealtimeListener() {
        try {
            const leaderboardRef = ref(database, 'leaderboard');
            const topScoresQuery = query(leaderboardRef, orderByChild('score'), limitToLast(this.maxEntries));

            onValue(topScoresQuery, (snapshot) => {
                this.entries = [];
                if (snapshot.exists()) {
                    snapshot.forEach((childSnapshot) => {
                        this.entries.push({
                            id: childSnapshot.key,
                            ...childSnapshot.val()
                        });
                    });
                    // Sort by score descending (Firebase gives ascending)
                    this.entries.sort((a, b) => b.score - a.score);
                }
                this.isLoading = false;
                this.lastError = null;
            }, (error) => {
                console.error('Firebase error:', error);
                this.lastError = error.message;
                this.isLoading = false;
                // Fallback to empty leaderboard
                if (this.entries.length === 0) {
                    this.entries = [];
                }
            });
        } catch (e) {
            console.error('Firebase setup error:', e);
            this.isLoading = false;
            this.lastError = e.message;
        }
    }

    // Load leaderboard manually (for initial load or refresh)
    async loadLeaderboard() {
        try {
            this.isLoading = true;
            const leaderboardRef = ref(database, 'leaderboard');
            const topScoresQuery = query(leaderboardRef, orderByChild('score'), limitToLast(this.maxEntries));

            const snapshot = await get(topScoresQuery);
            this.entries = [];

            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    this.entries.push({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
                // Sort by score descending
                this.entries.sort((a, b) => b.score - a.score);
            }

            this.isLoading = false;
            this.lastError = null;
            return this.entries;
        } catch (e) {
            console.error('Error loading leaderboard:', e);
            this.lastError = e.message;
            this.isLoading = false;
            return this.entries;
        }
    }

    // Submit a new score to Firebase (returns rank synchronously, pushes async)
    submitScore(score, time, cigarettes) {
        const newEntry = {
            name: this.playerName,
            score: Math.floor(score),
            time: Math.floor(time),
            cigarettes: cigarettes,
            date: Date.now()
        };

        // Add locally first for immediate feedback
        this.entries.push(newEntry);
        this.entries.sort((a, b) => b.score - a.score);

        // Keep only top entries locally
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(0, this.maxEntries);
        }

        const rank = this.getRank(score);

        // Push to Firebase in background (realtime listener will sync)
        this.pushToFirebase(newEntry).catch(e => {
            console.error('Error submitting score:', e);
            this.lastError = e.message;
        });

        return rank;
    }

    // Async push to Firebase
    async pushToFirebase(entry) {
        const leaderboardRef = ref(database, 'leaderboard');
        await push(leaderboardRef, entry);
    }

    // Record a game (called even if score doesn't make leaderboard)
    recordGame(score, time, cigarettes) {
        // Just return rank, don't submit
        return this.getRank(score);
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
        // Find best score with player's name
        return this.entries.find(e => e.name === this.playerName);
    }

    isOnLeaderboard(score) {
        if (this.entries.length < this.maxEntries) return true;
        const lowestScore = this.entries[this.entries.length - 1]?.score || 0;
        return score > lowestScore;
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

    // Check if Firebase is connected
    isConnected() {
        return !this.isLoading && !this.lastError;
    }

    // Get loading/error status
    getStatus() {
        if (this.isLoading) return 'LOADING...';
        if (this.lastError) return 'OFFLINE';
        return 'LIVE';
    }
}
