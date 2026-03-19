# Smoking Simulator: Tile Table Edition (1987)

A satirical browser-based game about the absurdity of smoking. Survive as long as you can at an 80s tile table by chain-smoking cigarettes, drinking beer to stay awake, and managing increasingly chaotic drunk effects.

**This is a parody game meant for entertainment among friends who understand the risks of smoking and drinking.**

## Play Now

Open `index.html` in your browser, or serve with any HTTP server:

```bash
python3 -m http.server 8080
# Then open http://localhost:8080
```

## Gameplay

The premise is deliberately absurd: you'll die from "oxygen overdose" if you don't smoke enough!

### Controls

| Key | Action |
|-----|--------|
| **SPACE** | Smoke (reduces oxygen) |
| **B** | Drink beer (reduces drowsiness, increases drunkenness) |
| **WASD** | Stuff new cigarettes (mini-game) |
| **ENTER** | Start / Restart |
| **A** | View achievements (menu) |
| **L** | View leaderboard (menu) |

### Fail Conditions

- **Oxygen overdose** - Don't smoke for too long
- **Pass out** - Too drowsy (drink beer to stay awake)
- **Out of cigarettes** - Stuff new ones before you run out

### Features

- **Day/Night Cycle** - Background changes from morning to night as you survive
- **14 Achievements** - Including "Chain Smoker", "Functional Alcoholic", "Night Owl"
- **Leaderboard** - Track your high scores against simulated competitors
- **Drunk Effects** - Screen wobble, double vision, control inversion, audio pitch wobble
- **Hiccups** - Random hiccups block your inputs when drunk
- **80s Aesthetic** - CRT scanlines, retro color palette, synth music
- **Procedural Audio** - Generated 8-bit style background music

## Tech Stack

Pure vanilla JavaScript + HTML5 Canvas. No dependencies.

```
alg_simulator/
├── index.html
├── css/style.css
└── js/
    ├── main.js
    ├── game/
    │   ├── Game.js
    │   ├── Player.js
    │   └── InputHandler.js
    └── systems/
        ├── RenderSystem.js
        ├── AudioSystem.js
        ├── StuffingSystem.js
        ├── AchievementSystem.js
        ├── LeaderboardSystem.js
        └── DayNightSystem.js
```

## Screenshots

The game features:
- Animated wall clock
- Window showing sky/stars based on time of day
- Neon "SMOKE BREAK" sign
- Hand holding cigarette with smoke particles
- CRT monitor frame with scanlines

## License

MIT
