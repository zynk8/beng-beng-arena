
# Tactical FPS Development Rules (Vue 3 + Phaser 4 + Three.js)

This document outlines the architectural standards, coding conventions, and integration patterns for building a competitive tactical FPS using the "Tri-Engine" stack.

## 1. Core Architectural Principles

### 1.1 Separation of Concerns
- **Vue 3:** Exclusively for non-gameplay UI (HUD, Buy Menu, Settings, Matchmaking Lobby). Use Tailwind CSS for styling.
- **Phaser 4:** Responsible for the Game Loop orchestration, 2D UI overlays (Minimap, Hitmarkers), and Scene Management.
- **Three.js:** Handles the 3D World (Level geometry, Player models, Lighting) and the First-Person Viewmodel.
- **Rapier.js:** Primary engine for character controllers and collision detection.

### 1.2 State Management (The Bridge)
- Use **Pinia** as the single source of truth for "Game State" (Score, Health, Inventory).
- Game engines (Phaser/Three) should push updates to Pinia via a `GameBridge` utility.
- Vue components must subscribe to Pinia to update the HUD.

## 2. Rendering Pipeline Rules

### 2.1 The Layering Stack (Z-Index)
1. **Background Layer:** Three.js World (Environment).
2. **Overlay Layer:** Three.js Viewmodel (Gun/Arms - rendered with `depthTest: false` or a separate camera).
3. **2D Layer:** Phaser 4 Nodes (HUD elements, dynamic crosshairs).
4. **DOM Layer:** Vue 3 Components (Interactive menus, chat).

### 2.2 Phaser 4 + Three.js Integration
- Initialize Three.js within a Phaser 4 `RenderNode`.
- Synchronize the Phaser Game Clock with the Three.js `requestAnimationFrame`.
- Ensure `alpha: true` is enabled on the Phaser canvas to allow Three.js visibility if required by layering.

## 3. Gameplay & Physics

### 3.1 Character Controller (FPS)
- Use **Pointer Lock API** for mouse look.
- Implement a **Kinematic Character Controller** in Rapier.js for movement.
- **Step Height:** 0.5 units (for stairs).
- **Gravity:** -9.81m/s² (tweak for "snappy" tactical feel).

### 3.2 Combat Logic
- **Raycasting:** Use Three.js `Raycaster` or Rapier's physics rays for hit-scan weapons.
- **Tick Rate:** The simulation should run at 64Hz or 128Hz, decoupled from the rendering frame rate.
- **Lag Compensation:** Client-side prediction is mandatory for movement; server-side reconciliation for hits (if multiplayer).

## 4. Coding Conventions (TypeScript)

- **Strict Mode:** Always enabled.
- **Interfaces:** Every game object (Player, Weapon, Projectile) must have a strictly defined interface.
- **Asset Loading:** Use Phaser 4’s `Loader` to manage 3D GLTF files and 2D textures to ensure centralized progress tracking.
- **Disposal:** Always implement a `destroy()` or `dispose()` method for Three.js geometries/textures to prevent memory leaks during scene transitions.

## 5. Performance Optimization
- **Frustum Culling:** Ensure Three.js correctly culls level geometry not visible to the player.
- **Draw Calls:** Batch 2D UI elements in Phaser 4.
- **Texture Compression:** Use Basis Universal (KTX2) for 3D textures.

## 6. CSS & UI Standards
- Use **Tailwind CSS** for all Vue components.
- HUD components must use `pointer-events: none` unless a menu is active (e.g., Buy Menu).
- Fonts should be loaded via CSS to avoid "pop-in" during game initialization.
rules.md
Displaying rules.md.