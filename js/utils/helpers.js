// Utility functions

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function lerp(start, end, t) {
    return start + (end - start) * t;
}

export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

export function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
}

export function randomChoice(array) {
    return array[randomInt(0, array.length - 1)];
}

export function shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
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

// Easing functions
export const ease = {
    inOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    out: t => 1 - Math.pow(1 - t, 3),
    in: t => t * t * t,
    elastic: t => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 :
            Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
};
