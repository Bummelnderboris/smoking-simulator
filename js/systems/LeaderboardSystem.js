// Leaderboard System - Firebase-powered global leaderboard
import { database, ref, push, get, query, orderByChild, limitToLast, onValue } from '../firebase-config.js';
import { GAME_MODES } from '../utils/constants.js';

export class LeaderboardSystem {
    constructor() {
        this.entries = [];
        this.playerName = 'PLAYER';
        this.maxEntries = 20; // Store more entries to filter by mode
        this.isLoading = true;
        this.lastError = null;
        this.currentFilter = null; // null = all, 'hartz_iv', 'gaming'

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
    submitScore(score, time, cigarettes, gameMode, level = 1) {
        const newEntry = {
            name: this.playerName,
            score: Math.floor(score),
            time: Math.floor(time),
            cigarettes: cigarettes,
            mode: gameMode || GAME_MODES.HARTZ_IV,
            level: level,
            date: Date.now()
        };

        // Add locally first for immediate feedback
        this.entries.push(newEntry);
        this.entries.sort((a, b) => b.score - a.score);

        // Keep only top entries locally
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(0, this.maxEntries);
        }

        const rank = this.getRank(score, gameMode);

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
    recordGame(score, time, cigarettes, gameMode) {
        // Just return rank, don't submit
        return this.getRank(score, gameMode);
    }

    // Set filter for displaying entries
    setFilter(mode) {
        this.currentFilter = mode; // null = all, 'hartz_iv', 'gaming'
    }

    // Get filtered entries
    getFilteredEntries() {
        if (!this.currentFilter) {
            return this.entries;
        }
        return this.entries.filter(e => e.mode === this.currentFilter);
    }

    getRank(score, gameMode = null) {
        // If gameMode specified, rank within that mode only
        let entries = gameMode
            ? this.entries.filter(e => e.mode === gameMode)
            : this.entries;

        const sorted = [...entries].sort((a, b) => b.score - a.score);
        for (let i = 0; i < sorted.length; i++) {
            if (score >= sorted[i].score) {
                return i + 1;
            }
        }
        return sorted.length + 1;
    }

    getTopEntries(count = 10, gameMode = null) {
        let entries = gameMode
            ? this.entries.filter(e => e.mode === gameMode)
            : this.entries;
        return entries.slice(0, count);
    }

    getPlayerBest(gameMode = null) {
        // Find best score with player's name (optionally filtered by mode)
        let entries = gameMode
            ? this.entries.filter(e => e.mode === gameMode)
            : this.entries;
        return entries.find(e => e.name === this.playerName);
    }

    isOnLeaderboard(score, gameMode = null) {
        const entries = gameMode
            ? this.entries.filter(e => e.mode === gameMode)
            : this.entries;
        if (entries.length < 10) return true;
        const lowestScore = entries[entries.length - 1]?.score || 0;
        return score > lowestScore;
    }

    // Get mode display name
    getModeDisplayName(mode) {
        if (mode === GAME_MODES.GAMING) return 'GAMING';
        if (mode === GAME_MODES.HARTZ_IV) return 'HARTZ IV';
        return 'CLASSIC';
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
