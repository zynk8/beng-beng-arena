# Tactical FPS Game Architecture

This folder keeps game logic separate from Vue UI while still allowing Vue to own menus, HUD, settings, and layout.

## Folder Structure

- `application/`: gameplay use cases and controllers, such as `FirstPersonController`.
- `domain/`: pure tactical FPS rules and entities. Add weapon definitions, economy rules, team rules, and round state here.
- `input/`: browser and device input adapters. `PointerLockInput` converts DOM events into frame snapshots.
- `physics/`: Rapier-backed collision and character movement.
- `rendering/`: Three.js world/viewmodel rendering and Phaser RenderNode integration adapters.
- `scenes/`: Phaser scenes. `MainScene` orchestrates fixed-step updates and 2D overlay drawing.
- `state/`: Pinia bridge layer shared by Vue, Phaser, and Three.js.
- `types/`: strict TypeScript contracts shared across layers.

## Rendering Stack

1. Three.js world canvas is mounted in `GameContainer.vue` behind Phaser.
2. Three.js renders the world camera first.
3. Three.js renders the weapon viewmodel scene after `clearDepth()`, using depth-disabled materials so the gun cannot clip into walls.
4. Phaser draws crosshair/minimap overlays above the 3D canvas.
5. Vue draws interactive DOM HUD and menus above both engines.

`PhaserThreeRenderNode.ts` isolates the Phaser 4 RenderNode registration. The scene also calls `threeRenderer.render()` directly so the prototype remains stable if Phaser internals change while Phaser 4 APIs settle.

## State Flow

Engines write through `GameBridge`.

Vue reads from `useGameState()`.

This keeps high-frequency engine code from importing Vue components and keeps UI code from reaching into Three.js scene objects.
