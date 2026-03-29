// Utility functions

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Drunk text effect - occasionally swap letters
export function drunkifyText(text, drunkLevel) {
    if (drunkLevel < 50) return text;

    const chars = text.split('');
    const swapChance = (drunkLevel - 50) / 200;

    for (let i = 0; i < chars.length - 1; i++) {
        if (Math.random() < swapChance) {
            [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
            i++;
        }
    }
    return chars.join('');
}

// Generate wobble offset based on time and drunk level
export function getWobbleOffset(time, drunkLevel, intensity = 1) {
    if (drunkLevel < 25) return { x: 0, y: 0 };

    const factor = (drunkLevel - 25) / 75 * intensity;
    return {
        x: Math.sin(time / 200) * factor * 5 + Math.sin(time / 70) * factor * 2,
        y: Math.cos(time / 180) * factor * 3 + Math.cos(time / 90) * factor * 1.5
    };
}

// Format time as MM:SS
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Format score with commas
export function formatScore(score) {
    return Math.floor(score).toLocaleString();
}
