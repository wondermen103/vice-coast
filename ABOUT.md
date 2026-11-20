# Vice Coast — 3D Game Engine Architecture & Gameplay Overview

Vice Coast is a high-performance, open-world 3D coastal crime action game built for modern web browsers using **Three.js** and **TypeScript**. Set along the sun-drenched boulevards, neon-lit shorelines, and towering glass skyscrapers of Vice Coast, the game delivers an arcade sandbox experience complete with vehicle dynamics, multi-tiered police heat response, story missions, weapons ballistics, dynamic day/night cycles with tropical weather, and a real-time procedural synthesizer radio engine.

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [World Rendering & Environment](#world-rendering--environment)
3. [Vehicle Dynamics & Traffic Simulation](#vehicle-dynamics--traffic-simulation)
4. [Weapons & Combat System](#weapons--combat-system)
5. [Wanted Levels & Police Response](#wanted-levels--police-response)
6. [Procedural Synthesizer Radio](#procedural-synthesizer-radio)
7. [Day/Night Cycle & Dynamic Weather](#daynight-cycle--dynamic-weather)
8. [Gameplay Progression & Missions](#gameplay-progression--missions)
9. [Standalone Distribution & Verification](#standalone-distribution--verification)

---

## 1. High-Level Architecture

The Vice Coast engine is organized into modular subsystems coordinated by a central orchestrator:

- **`GameEngine.ts`**: The central lifecycle coordinator. Manages the Three.js scene, camera setup, fixed-timestep physics updates (`fixed-dt`), hitstop frame freezing for impact satisfaction, software WebGL fallbacks, and throttled state bridges to the React UI overlay.
- **`Input.ts`**: Unified input manager supporting keyboard (WASD/arrows, space, shift, F, E, numeric keys, Esc) and mouse (first/third-person steering, free look, reticle aiming, weapon firing).
- **`Collision.ts`**: Spatial collision grid managing bounding boxes, building footprints, pier boundaries, water perimeters, and line-of-sight raycasts for NPC vision and ballistic hit testing.
- **`MinimapRenderer.ts`**: Vector radar display that renders road geometry, GPS waypoints, player heading, police search cones, and objective blips directly to an HTML5 canvas element.

```
                    ┌─────────────────────────┐
                    │      Input System       │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │       GameEngine        │
                    │ (Fixed-dt Loop & State) │
                    └──────┬───────────┬──────┘
                           │           │
         ┌─────────────────┴─┐       ┌─┴─────────────────┐
         │ World Subsystems  │       │ Action Subsystems │
         ├───────────────────┤       ├───────────────────┤
         │ CityBuilder       │       │ PlayerController  │
         │ CityLayout        │       │ Vehicle Physics   │
         │ SkyAndSun         │       │ Combat & Weapons  │
         │ Props & Textures  │       │ WantedSystem      │
         │ PostFX Pipeline   │       │ PoliceDispatch    │
         └─────────┬─────────┘       └─────────┬─────────┘
                   │                           │
                   └─────────────┬─────────────┘
                                 ▼
             ┌───────────────────────────────────────┐
             │ AudioEngine & Procedural RadioSynth   │
             │ React HUD / Canvas Minimap UI         │
             └───────────────────────────────────────┘
```

---

## 2. World Rendering & Environment

The Vice Coast world is procedural and grid-aligned, balancing visual fidelity with high frame rates:

- **Procedural Urban Zoning (`CityLayout.ts` & `CityBuilder.ts`)**:
  - **Ocean Drive**: Iconic waterfront promenade with pastel Art Deco hotels, street-level cocktail lounges, outdoor dining patios, and illuminated neon marquees.
  - **Downtown Core**: Dense curtain-wall glass skyscrapers, corporate plazas, and multi-level parking structures.
  - **Palm Heights**: Mediterranean villas featuring terracotta tiled roofs, white stucco facades, and private swimming pools.
  - **Pelican Marina & Docks**: Wooden fishing piers, boat slips, corrugated sheet-metal warehouses, and industrial cranes.
  - **Coastal Beaches**: Expansive sand banks with animated ocean waves, palm trees, beach towels, and lifeguard towers.
- **Batched Geometry & PBR Shading (`MeshKit.ts`, `Textures.ts`)**:
  - Buildings, sidewalks, and streets utilize batched instancing and shared texture atlases to minimize WebGL draw calls.
  - Custom procedural PBR materials simulate stucco, asphalt aggregate, sand, corrugated metal, and tinted architectural glass.
  - Custom window shaders project fake interior depth via UV coordinates, with dynamic emissive night illumination driven by time of day.
- **Environmental Props (`Props.ts`)**:
  - Procedurally scattered coconut palms, street lamps with night glow, traffic signals, fire hydrants, trash bins, road barriers, and stunt ramps.
- **Post-Processing & Performance (`PostFX.ts`)**:
  - High Dynamic Range (HDR) bloom effect for neon lights and sun glints, vignette shading, chromatic aberration during nitrous boosts, and tone-mapping.
  - Automatic software-WebGL detection (`detectSoftwareGl`) and fence-sync pacing to guarantee smooth 60 FPS performance across diverse hardware.

---

## 3. Vehicle Dynamics & Traffic Simulation

Vehicles in Vice Coast blend responsive arcade handling with physical simulation:

- **Arcade Physics Model (`Vehicle.ts`)**:
  - Realistic forward acceleration curves, reverse gearing, and speed-capped top thresholds.
  - Dynamic lateral tire friction allowing responsive high-speed drifts when applying the handbrake (`Space`).
  - Active suspension simulation calculating pitch and roll body lean during braking, hard turns, and acceleration.
  - Stunt detection system calculating air-time, ramp jumps (`sampleStuntRamp`), and landing impact physics.
- **Nitrous Boost System**:
  - Instantaneous acceleration surge accompanied by exhaust flame particles, camera FOV expansion, and motion blur.
  - Finite nitrous meter that recharges through near-misses, high-speed drifting, and stunts.
- **Vehicle Roster (`CarModels.ts`)**:
  - **Viper Comet RS**: High-performance exotic sports coupe engineered for drifting.
  - **Stallion GT**: Heavy American muscle car with immense straight-line torque.
  - **Cyclone Hyper**: Ultra-lightweight hypercar with active neon underglow and top-tier speed.
  - **Meridian Cruiser**: Luxury four-door coastal sedan.
  - **PCPD Interceptor**: Reinforced police pursuit cruiser fitted with high-intensity siren lightbars.
  - **Transport Van**: Heavy industrial cargo vehicle with high mass and ramming resistance.
- **Carjacking Mechanics (`Carjacking.ts`)**:
  - Players can approach any civilian or police vehicle to seize control.
  - Animated driver expulsion, door mechanics, alarm audio, and instant police heat accrual if witnessed.
- **Traffic AI (`TrafficAI.ts`)**:
  - Autonomous civilian vehicles navigating multi-lane arterial roads.
  - Real-time lane following, intersection yielding, traffic light compliance, and collision obstacle avoidance.
  - Civilian panic triggers: Gunfire or heavy collisions prompt civilian drivers to honk, swerve, and speed away.

---

## 4. Weapons & Combat System

Combat combines fluid third-person and vehicular drive-by ballistics:

- **6-Tier Arsenal (`WEAPONS` in `Weapons.ts`)**:
  1. **Fists**: Close-quarters melee with knockback impulses.
  2. **Vesper 9 (Sidearm)**: Semi-automatic 9mm handgun balancing accuracy and moderate fire rate.
  3. **Mako SMG (Rapid Auto)**: High-rate-of-fire submachine gun optimized for drive-by shooting.
  4. **Breaker 12 (Close Spread)**: 7-pellet shotgun delivering devastating close-range kinetic damage.
  5. **Kestrel AR (Long Precision)**: Military assault rifle providing extreme range and high damage.
  6. **Solstice GL (Explosive Blast)**: Heavy launcher firing explosive rounds with AoE splash radius and vehicle launch force.
- **Ballistics & Targeting**:
  - Hitscan trajectory calculations with weapon-specific spread cones and range falloffs.
  - 3D visual tracer lines, muzzle flashes, and impact spark/smoke particles (`Particles.ts`).
  - Soft auto-aim target acquisition assisting keyboard/mouse and gamepad players.
  - Hitmarkers and directional sound cues confirming successful enemy hits.
- **Slow-Motion Focus Mode**:
  - Bullet-time mode slowing world simulation to 30% speed while retaining full player aiming capability, allowing surgical precision during shootouts and high-speed chases.

---

## 5. Wanted Levels & Police Response

Vice Coast features an escalating 5-star police response system (`WantedSystem.ts`, `PoliceDispatch.ts`):

- **Heat Generation (`CRIME_HEAT`)**:
  - Infractions such as vehicle theft, assault, reckless pedestrian endangerment, weapons discharge, and officer casualty incrementally elevate heat points (0 to 185+).
- **Escalation Tiers**:
  - ★☆☆☆☆ (Level 1): Single patrol squad dispatched; basic pursuit.
  - ★★☆☆☆ (Level 2): Multiple patrol cruisers coordinate pursuit and attempt PIT maneuvers.
  - ★★★☆☆ (Level 3): Roadblocks deployed across major avenues; cruisers aggressively ram player vehicle.
  - ★★★★☆ (Level 4): Heavy tactical police response; officers engage on sight with high-caliber rifles.
  - ★★★★★ (Level 5): Total lockdown. Police helicopter unit (`HelicopterUnit.ts`) takes flight, deploying an active spotlight, aerial sniper tracking, and radio telemetry.
- **Evasion & Line of Sight**:
  - Escaping the line of sight of all cruisers, foot officers, and helicopters initiates an evasion countdown timer (`10s + level * 5s`).
  - Minimap displays law enforcement vision cones; breaking line-of-sight behind buildings or inside alleys allows heat to dissipate.

---

## 6. Procedural Synthesizer Radio

To eliminate external dependencies, copyright issues, and streaming latency, Vice Coast features a **100% procedural Web Audio synthesizer engine** (`AudioEngine.ts`, `RadioSynth.ts`):

- **Real-Time Sound Synthesis**:
  - Utilizes Web Audio API nodes (`OscillatorNode`, `BiquadFilterNode`, `GainNode`, `ConvolverNode`) to synthesize chords, basslines, percussion, and melodies on the fly.
  - Zero external MP3 or audio sample files required.
- **4 Coastal Radio Stations (`STATIONS`)**:
  - **VICE 98.1 FM (Sunset Synthwave, 100 BPM)**:
    - Lush polyphonic saw wave chords, analog bass arpeggios, and 80s gated reverb snare drums.
    - Track catalogue: *Neon Tide*, *Ocean Drive Mirage*, *Last Light Run*.
  - **WAVE 104.5 FM (Coastal Club Beats, 98 BPM)**:
    - Crisp syncopated sixteenth-note hi-hats, sub-bass kick patterns, and bright coastal pluck melodies.
    - Track catalogue: *Hot Sand Nights*, *Pier After Dark*, *Harbor Bass*.
  - **PULSE 101.9 FM (Miami Electro-Funk, 114 BPM)**:
    - Punchy slap basslines, rhythmic Rhodes chords, and energetic funk leads.
    - Track catalogue: *Chrome Horizon*, *Palm Heights Groove*, *Midnight Strip*.
  - **HARBOR 88.3 FM (Lo-Fi Marina, 76 BPM)**:
    - Relaxed swing percussion, jazzy minor 9th electric piano chords, and warm tape-saturation filters.
    - Track catalogue: *Fog Over Pier 9*, *Night Ferry*, *Saltwater Tape*.
- **Procedural Sound Effects**:
  - Engine revving and RPM frequency modulation, tire skid chirps, bullet crack ballistics, metal vehicle crumple impacts, sirens, and ocean wave noise.

---

## 7. Day/Night Cycle & Dynamic Weather

Atmospheric conditions evolve over time, dramatically transforming the visual aesthetic (`SkyAndSun.ts`, `WeatherRules.ts`):

- **Continuous 24-Hour Cycle**:
  - Real-time solar orbital progression governing sun position vector, directional lighting angle, and ambient color temperature.
  - Dynamic shadow mapping and sky dome gradient transitions:
    - `06:00 - 10:00`: Crisp morning dawn with long blue shadows.
    - `10:00 - 16:00`: High-noon tropical sun with bright ocean specular reflections.
    - `17:00 - 19:30`: Golden hour sunset with warm coral and amber hues.
    - `20:00 - 05:00`: Midnight neon sky with deep indigo gradients and twinkling procedural starfields.
- **Custom Atmospheric Shaders (`SKY_FRAG`)**:
  - Procedural Fractional Brownian Motion (fBm) cloud simulation.
  - Dynamic sun flare with horizon Mie scattering.
- **Dynamic Weather Modes**:
  - **Golden Hour**: Crisp skies, saturated palm silhouettes, and intense warm lighting.
  - **Coastal Noon**: High visibility, vibrant aqua water, and sharp shadows.
  - **Tropical Storm**: Low overcast cloud cover, 3D rain streaks (`LineSegments`), procedural thunder audio, randomized screen-illuminating lightning flashes, and dynamic road puddle wetness reflecting buildings.
  - **Midnight Neon**: Heightened contrast emphasizing hotel neon marquees, car headlights, and underglow lighting.

---

## 8. Gameplay Progression & Missions

- **Playable Protagonists (`PlayerController.ts`)**:
  - **Nico Vance**: Veteran wheelman with high drift control and vehicle recovery perks.
  - **Lupe Reyes**: Street-smart fixer with accelerated focus meter regeneration.
  - **Marco Santos**: Docks smuggler equipped with bonus physical armor resilience.
- **Narrative Story Arc (`StoryMissions.ts`)**:
  - An 8-mission campaign spanning car chases, asset retrieval, street races, smuggling drop-offs, and precinct escapes.
  - In-game dialogue boxes with stylized vector character portraits (`Portraits.ts`).
  - Cash economy enabling vehicle tuning, nitrous upgrades, custom paint finishes, and ammunition purchases.

---

## 9. Standalone Distribution & Verification

Vice Coast is packaged for zero-dependency offline desktop execution:

- **Entrypoint**: `game/index.html` loads all required ES modules and compiled bundles directly from local relative paths (`game/assets/`).
- **Offline Integrity**: No external CDN links, network tracking scripts, or font dependencies.
- **Judge Submission Pipeline (`main.ts`)**:
  - Standard library Node 22 harness that copies the standalone `game/` assets and `screenshots/` to the target evaluation directory.
  - Generates a compliant `dossier.json` summary via `vendor/makefun-game.ts`.
  - Enforces all competition criteria (file count <= 993, total game size <= 48 MiB, text <= 160 KiB, screenshots <= 4 and <= 256 KiB each).
