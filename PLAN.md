# Side-scrolling space shooter — plan

An original horizontal space shooter in the spirit of the 80s arcade classics.
The folder is called `gradius`. The game's name, ships, art, music and levels are all our own.

**Working title:** *Starwake* (change it any time)

## Choices made
- **Where it runs:** in the browser, live on Cloudflare like the other sites. It can be added to the Dock and played full screen.
- **Look:** modern and smooth: shaded ships, glow, particles, layered scrolling backgrounds.
- **First version:** one full stage, done properly. More stages come later.

## How it's built
- Plain HTML + JavaScript (ES modules), drawn on a `<canvas>`. No libraries and no build step, so it stays simple to change.
- The game draws at a fixed 1280×720 and scales to fit any window, keeping the shape.
- It runs at a steady 60 updates per second whatever the screen speed, so it feels the same on every Mac.
- **Art is drawn in code**: gradients, glow and shapes are drawn once into images at startup and then reused, which keeps it fast. There are no image files to manage.
- **Sound is made in code too** (Web Audio): laser zaps, explosions, power-up chimes and a simple synth music loop.
- High scores and settings are saved in the browser.

## Controls
| Action | Keyboard | Game controller |
|---|---|---|
| Move | Arrow keys / WASD | Stick / D-pad |
| Fire (hold) | Z or Space | A |
| Take power-up | X or Shift | B |
| Pause | P / Esc | Start |

On phones and tablets: drag anywhere to steer, the gun fires by itself, and on-screen buttons handle power-up, pause and sound.

## The power-up meter (the heart of the game)
Shoot down certain enemies and they drop **energy cells**. Each cell moves the highlight one slot along the meter at the bottom of the screen. Press **Take** to get whatever is highlighted, and the meter resets. You choose between taking a small upgrade now and saving up for a bigger one.

| Slot | What it does |
|---|---|
| 1. Thrust | Ship moves faster (up to 4 levels) |
| 2. Seekers | Small missiles that curve toward nearby enemies |
| 3. Fork | Two extra shots that fan out up and down |
| 4. Lance | Swaps the main gun for a long piercing beam |
| 5. Wingman | A glowing drone that copies your moves and shots (up to 3) |
| 6. Aegis | A front shield that soaks up hits and slowly wears away |

When you lose a life you lose your upgrades but keep one Wingman, so a comeback is still possible.

## Stage 1: "Halo Drift"
About 4–5 minutes long. Its own setting, not borrowed from any existing game.

1. **Open space**: deep blue nebula, waves of small fighters to warm up.
2. **Ice ring field**: drifting ice chunks you can shoot apart, and turrets on larger rocks.
   **CHECKPOINT** (losing a ship sends you back to the last checkpoint passed)
3. **Mid-boss**: a mining rig that sweeps a drill arm and fires rock bursts.
4. **Crystal canyon**: walls above and below with glowing crystals; enemies come out of side vents.
5. **Checkpoint**, then a quick high-speed section through a narrowing tunnel.
   **CHECKPOINT**
6. **Boss: the Lighthouse**: a big station whose rotating shutters open to show its weak core. It has 3 attack phases, and the attacks change as it takes damage.

### Enemies (first set)
| Name | Behaviour |
|---|---|
| Dart | Flies in a wave pattern, in groups of 5; drops a cell if you get the whole group |
| Sweeper | Swoops in, pauses, then dives at you |
| Bulb | Slow, tough, fires a spread of 3 shots |
| Turret | Fixed to ground or ceiling and aims at you |
| Hatch | Opens and lets out small enemies until destroyed |
| Shard | Ice chunk that breaks into smaller pieces when shot |

## Screens
Title → (short how-to-play card on first launch) → Stage → Stage clear / Game over → Name entry for high score.

## Folder layout
```
gradius/
  public/           everything that goes live
   index.html       page + canvas + on-screen touch buttons
   manifest.webmanifest, sw.js, icons/   installable app (PWA), offline
   style.css
   src/
    main.js         start-up, game loop
   game.js         the world: collisions, score, lives, game over
   stage.js         runs a stage: events by distance, checkpoints, rewind
    config.js       screen size, shared helpers
    background.js   sky, nebula, star layers
    input.js        keyboard, touch (drag to steer), controller later
    art.js          code-drawn ships, enemies, effects
   audio.js         sound effects + music
    player.js       ship, weapons, wingmen, shield
    powerups.js     the meter
    enemies.js      enemy types
   bosses.js        Mining Rig (mid-boss) + the Lighthouse (stage boss)
   stage1.js        Stage 1: wall shapes, speed, and what appears when
   terrain.js       canyon and tunnel walls, crystals
    fx.js           particles, explosions, screen shake
    post.js         bloom glow pass
    ui.js           score, lives, meter, menus
  wrangler.toml     Cloudflare deploy settings
  PLAN.md
```

## Steps (each one is playable)
1. ✅ **Fly and shoot**: ship, controls, main gun, scrolling star layers, scaling to the window.
2. ✅ **Enemies and the meter**: the first 3 enemy types, energy cells, the power-up meter and all 6 upgrades.
2.5 ✅ **Sound** (moved up from step 5): synth sound effects for every action, and an original synthwave music track. M mutes.
3. ✅ **The stage**: the timeline system, all 6 enemies, the ice field and canyon walls, the checkpoint.
4. ✅ **Bosses**: the mining rig mid-boss and the Lighthouse boss.
5.5 ✅ **Mobile + app**: touch controls (drag to steer, auto-fire, POWER / pause / sound buttons), bigger HUD on phones, "turn sideways" card, installable as an app (PWA) that works offline.
5. ✅ **Look and feel**: screen shake (world only, HUD stays still), richer explosions (fireball, spark streaks, embers, wreckage, smoke, light flash), a split-second freeze on deaths, red flash when hit, a bloom glow pass that switches itself off on slow devices. Boss music was done in 2.5.
6. **Finish**: title screen, game over, high scores, pause, controller support, tuning difficulty.
7. **Go live** on Cloudflare.

## Still to decide
- Final game name.
- Difficulty: arcade-hard, or easier with more lives?
