import type { TacticalMapId, Vec3 } from '../types/game';

export type MapBlockKind = 'wall' | 'cover' | 'crate' | 'platform' | 'spawn';

export interface MapBlock {
  id: string;
  kind: MapBlockKind;
  position: Vec3;
  size: Vec3;
  color: number;
}

export interface TacticalMapDefinition {
  id: TacticalMapId;
  displayName: string;
  floorSize: Vec3;
  playerStart: Vec3;
  allyStarts: Vec3[];
  enemyStarts: Vec3[];
  allyBuyZone: { center: Vec3; size: Vec3 };
  enemyBuyZone: { center: Vec3; size: Vec3 };
  blocks: MapBlock[];
}

const wallColor = 0x7f7c7b;
const trimColor = 0x39424c;
const crateColor = 0x8c5d3d;
const platformColor = 0x5a646c;

export const deathmatch1Map: TacticalMapDefinition = {
  id: 'deathmatch1',
  displayName: 'Beng Beng Hub',
  floorSize: { x: 60, y: 0.2, z: 64 },
  playerStart: { x: 0, y: 1.8, z: 25 },
  allyStarts: [
    { x: -8, y: 0, z: 25 },
    { x: -4, y: 0, z: 25.5 },
    { x: 0, y: 0, z: 26 },
    { x: 4, y: 0, z: 25.5 },
    { x: 8, y: 0, z: 25 },
  ],
  enemyStarts: [
    { x: -9, y: 1, z: -25 },
    { x: 0, y: 1, z: -27 },
    { x: 9, y: 1, z: -25 },
    { x: -14, y: 1, z: -18 },
    { x: 14, y: 1, z: -18 },
  ],
  allyBuyZone: { center: { x: 0, y: 0, z: 25 }, size: { x: 19, y: 2, z: 7 } },
  enemyBuyZone: { center: { x: 0, y: 0, z: -25 }, size: { x: 21, y: 2, z: 7 } },
  blocks: [
    { id: 'north-wall', kind: 'wall', position: { x: 0, y: 2.3, z: -32 }, size: { x: 60, y: 4.6, z: 0.6 }, color: wallColor },
    { id: 'south-wall', kind: 'wall', position: { x: 0, y: 2.3, z: 32 }, size: { x: 60, y: 4.6, z: 0.6 }, color: wallColor },
    { id: 'west-wall', kind: 'wall', position: { x: -30, y: 2.3, z: 0 }, size: { x: 0.6, y: 4.6, z: 64 }, color: wallColor },
    { id: 'east-wall', kind: 'wall', position: { x: 30, y: 2.3, z: 0 }, size: { x: 0.6, y: 4.6, z: 64 }, color: wallColor },

    { id: 'enemy-left-gate', kind: 'wall', position: { x: -14, y: 1.7, z: -20 }, size: { x: 10, y: 3.4, z: 0.55 }, color: trimColor },
    { id: 'enemy-right-gate', kind: 'wall', position: { x: 14, y: 1.7, z: -20 }, size: { x: 10, y: 3.4, z: 0.55 }, color: trimColor },
    { id: 'ally-left-gate', kind: 'wall', position: { x: -14, y: 1.7, z: 20 }, size: { x: 10, y: 3.4, z: 0.55 }, color: trimColor },
    { id: 'ally-right-gate', kind: 'wall', position: { x: 14, y: 1.7, z: 20 }, size: { x: 10, y: 3.4, z: 0.55 }, color: trimColor },

    { id: 'mid-long-left', kind: 'wall', position: { x: -8, y: 1.7, z: 0 }, size: { x: 0.55, y: 3.4, z: 22 }, color: trimColor },
    { id: 'mid-long-right', kind: 'wall', position: { x: 8, y: 1.7, z: 0 }, size: { x: 0.55, y: 3.4, z: 22 }, color: trimColor },
    { id: 'left-lane-divider', kind: 'wall', position: { x: -20, y: 1.7, z: 0 }, size: { x: 0.55, y: 3.4, z: 26 }, color: trimColor },
    { id: 'right-lane-divider', kind: 'wall', position: { x: 20, y: 1.7, z: 0 }, size: { x: 0.55, y: 3.4, z: 26 }, color: trimColor },

    { id: 'left-catwalk', kind: 'platform', position: { x: -20, y: 0.45, z: -11 }, size: { x: 8, y: 0.9, z: 9 }, color: platformColor },
    { id: 'right-catwalk', kind: 'platform', position: { x: 20, y: 0.45, z: -11 }, size: { x: 8, y: 0.9, z: 9 }, color: platformColor },
    { id: 'upper-mid', kind: 'platform', position: { x: 0, y: 0.35, z: -8 }, size: { x: 10, y: 0.7, z: 5 }, color: platformColor },
    { id: 'lower-mid', kind: 'platform', position: { x: 0, y: 0.25, z: 8 }, size: { x: 10, y: 0.5, z: 5 }, color: platformColor },

    { id: 'center-cover', kind: 'cover', position: { x: 0, y: 0.8, z: 0 }, size: { x: 4.4, y: 1.6, z: 4.4 }, color: 0x3f454b },
    { id: 'mid-left-cover', kind: 'cover', position: { x: -13.6, y: 0.8, z: -3 }, size: { x: 3, y: 1.6, z: 3 }, color: 0x3f454b },
    { id: 'mid-right-cover', kind: 'cover', position: { x: 13.6, y: 0.8, z: -3 }, size: { x: 3, y: 1.6, z: 3 }, color: 0x3f454b },
    { id: 'ally-cover-left', kind: 'crate', position: { x: -8, y: 0.75, z: 16 }, size: { x: 4, y: 1.5, z: 2.2 }, color: crateColor },
    { id: 'ally-cover-right', kind: 'crate', position: { x: 8, y: 0.75, z: 16 }, size: { x: 4, y: 1.5, z: 2.2 }, color: crateColor },
    { id: 'enemy-cover-left', kind: 'crate', position: { x: -8, y: 0.75, z: -16 }, size: { x: 4, y: 1.5, z: 2.2 }, color: crateColor },
    { id: 'enemy-cover-right', kind: 'crate', position: { x: 8, y: 0.75, z: -16 }, size: { x: 4, y: 1.5, z: 2.2 }, color: crateColor },
    { id: 'left-lane-crates-a', kind: 'crate', position: { x: -24, y: 0.75, z: 6 }, size: { x: 2.4, y: 1.5, z: 3.5 }, color: crateColor },
    { id: 'left-lane-crates-b', kind: 'crate', position: { x: -24, y: 1.45, z: -8 }, size: { x: 2, y: 2.9, z: 2 }, color: crateColor },
    { id: 'right-lane-crates-a', kind: 'crate', position: { x: 24, y: 0.75, z: 6 }, size: { x: 2.4, y: 1.5, z: 3.5 }, color: crateColor },
    { id: 'right-lane-crates-b', kind: 'crate', position: { x: 24, y: 1.45, z: -8 }, size: { x: 2, y: 2.9, z: 2 }, color: crateColor },
    { id: 'ally-spawn-marker', kind: 'spawn', position: { x: 0, y: 0.04, z: 25 }, size: { x: 19, y: 0.08, z: 7 }, color: 0x0d89b8 },
    { id: 'enemy-spawn-marker', kind: 'spawn', position: { x: 0, y: 0.04, z: -25 }, size: { x: 21, y: 0.08, z: 7 }, color: 0xd93b48 },
  ],
};

const boundaryBlocks = deathmatch1Map.blocks.filter((block) =>
  ['north-wall', 'south-wall', 'west-wall', 'east-wall'].includes(block.id),
);

export const dockyardMap: TacticalMapDefinition = {
  id: 'dockyard',
  displayName: 'Container Dockyard',
  floorSize: { x: 60, y: 0.2, z: 64 },
  playerStart: { x: -10, y: 1.8, z: 25 },
  allyStarts: [
    { x: -12, y: 0, z: 25 },
    { x: -6, y: 0, z: 26 },
    { x: 0, y: 0, z: 25.2 },
    { x: 6, y: 0, z: 26 },
    { x: 12, y: 0, z: 25 },
  ],
  enemyStarts: [
    { x: -12, y: 1, z: -25 },
    { x: -6, y: 1, z: -26 },
    { x: 0, y: 1, z: -25.2 },
    { x: 6, y: 1, z: -26 },
    { x: 12, y: 1, z: -25 },
  ],
  allyBuyZone: { center: { x: 0, y: 0, z: 25.5 }, size: { x: 28, y: 2, z: 7 } },
  enemyBuyZone: { center: { x: 0, y: 0, z: -25.5 }, size: { x: 28, y: 2, z: 7 } },
  blocks: [
    ...boundaryBlocks,
    { id: 'dock-left-stack-a', kind: 'wall', position: { x: -18, y: 1.35, z: -8 }, size: { x: 6, y: 2.7, z: 16 }, color: trimColor },
    { id: 'dock-left-stack-b', kind: 'wall', position: { x: -18, y: 1.35, z: 12 }, size: { x: 6, y: 2.7, z: 12 }, color: trimColor },
    { id: 'dock-right-stack-a', kind: 'wall', position: { x: 18, y: 1.35, z: 8 }, size: { x: 6, y: 2.7, z: 16 }, color: trimColor },
    { id: 'dock-right-stack-b', kind: 'wall', position: { x: 18, y: 1.35, z: -12 }, size: { x: 6, y: 2.7, z: 12 }, color: trimColor },
    { id: 'dock-mid-container-a', kind: 'crate', position: { x: -5, y: 0.9, z: -2 }, size: { x: 8, y: 1.8, z: 3.2 }, color: 0x2f6f86 },
    { id: 'dock-mid-container-b', kind: 'crate', position: { x: 5, y: 0.9, z: 4 }, size: { x: 8, y: 1.8, z: 3.2 }, color: 0xb0463c },
    { id: 'dock-mid-container-c', kind: 'crate', position: { x: 0, y: 1.55, z: 0.8 }, size: { x: 3, y: 3.1, z: 7 }, color: crateColor },
    { id: 'dock-ally-crate-left', kind: 'cover', position: { x: -10, y: 0.7, z: 16 }, size: { x: 4.6, y: 1.4, z: 2 }, color: 0x3f454b },
    { id: 'dock-ally-crate-right', kind: 'cover', position: { x: 10, y: 0.7, z: 16 }, size: { x: 4.6, y: 1.4, z: 2 }, color: 0x3f454b },
    { id: 'dock-enemy-crate-left', kind: 'cover', position: { x: -10, y: 0.7, z: -16 }, size: { x: 4.6, y: 1.4, z: 2 }, color: 0x3f454b },
    { id: 'dock-enemy-crate-right', kind: 'cover', position: { x: 10, y: 0.7, z: -16 }, size: { x: 4.6, y: 1.4, z: 2 }, color: 0x3f454b },
    { id: 'dock-left-platform', kind: 'platform', position: { x: -25, y: 0.35, z: 0 }, size: { x: 5, y: 0.7, z: 14 }, color: platformColor },
    { id: 'dock-right-platform', kind: 'platform', position: { x: 25, y: 0.35, z: 0 }, size: { x: 5, y: 0.7, z: 14 }, color: platformColor },
    { id: 'dock-ally-spawn-marker', kind: 'spawn', position: { x: 0, y: 0.04, z: 25.5 }, size: { x: 28, y: 0.08, z: 7 }, color: 0x0d89b8 },
    { id: 'dock-enemy-spawn-marker', kind: 'spawn', position: { x: 0, y: 0.04, z: -25.5 }, size: { x: 28, y: 0.08, z: 7 }, color: 0xd93b48 },
  ],
};

export const rooftopMap: TacticalMapDefinition = {
  id: 'rooftop',
  displayName: 'Rooftop Checkpoint',
  floorSize: { x: 60, y: 0.2, z: 64 },
  playerStart: { x: 0, y: 1.8, z: 24 },
  allyStarts: [
    { x: -10, y: 0, z: 24 },
    { x: -5, y: 0, z: 26 },
    { x: 0, y: 0, z: 24 },
    { x: 5, y: 0, z: 26 },
    { x: 10, y: 0, z: 24 },
  ],
  enemyStarts: [
    { x: -10, y: 1, z: -24 },
    { x: -5, y: 1, z: -26 },
    { x: 0, y: 1, z: -24 },
    { x: 5, y: 1, z: -26 },
    { x: 10, y: 1, z: -24 },
  ],
  allyBuyZone: { center: { x: 0, y: 0, z: 24.5 }, size: { x: 24, y: 2, z: 8 } },
  enemyBuyZone: { center: { x: 0, y: 0, z: -24.5 }, size: { x: 24, y: 2, z: 8 } },
  blocks: [
    ...boundaryBlocks,
    { id: 'roof-left-terrace', kind: 'platform', position: { x: -18, y: 0.55, z: -5 }, size: { x: 10, y: 1.1, z: 17 }, color: platformColor },
    { id: 'roof-right-terrace', kind: 'platform', position: { x: 18, y: 0.55, z: 5 }, size: { x: 10, y: 1.1, z: 17 }, color: platformColor },
    { id: 'roof-center-core', kind: 'wall', position: { x: 0, y: 1.75, z: 0 }, size: { x: 9, y: 3.5, z: 8 }, color: trimColor },
    { id: 'roof-center-door-a', kind: 'cover', position: { x: -6.5, y: 0.8, z: -7 }, size: { x: 3.4, y: 1.6, z: 2 }, color: 0x3f454b },
    { id: 'roof-center-door-b', kind: 'cover', position: { x: 6.5, y: 0.8, z: 7 }, size: { x: 3.4, y: 1.6, z: 2 }, color: 0x3f454b },
    { id: 'roof-left-vents-a', kind: 'crate', position: { x: -24, y: 0.85, z: 12 }, size: { x: 3.4, y: 1.7, z: 5 }, color: crateColor },
    { id: 'roof-left-vents-b', kind: 'crate', position: { x: -24, y: 0.85, z: -15 }, size: { x: 3.4, y: 1.7, z: 5 }, color: crateColor },
    { id: 'roof-right-vents-a', kind: 'crate', position: { x: 24, y: 0.85, z: 15 }, size: { x: 3.4, y: 1.7, z: 5 }, color: crateColor },
    { id: 'roof-right-vents-b', kind: 'crate', position: { x: 24, y: 0.85, z: -12 }, size: { x: 3.4, y: 1.7, z: 5 }, color: crateColor },
    { id: 'roof-ally-barricade', kind: 'cover', position: { x: 0, y: 0.75, z: 15.5 }, size: { x: 13, y: 1.5, z: 1.7 }, color: 0x3f454b },
    { id: 'roof-enemy-barricade', kind: 'cover', position: { x: 0, y: 0.75, z: -15.5 }, size: { x: 13, y: 1.5, z: 1.7 }, color: 0x3f454b },
    { id: 'roof-ally-spawn-marker', kind: 'spawn', position: { x: 0, y: 0.04, z: 24.5 }, size: { x: 24, y: 0.08, z: 8 }, color: 0x0d89b8 },
    { id: 'roof-enemy-spawn-marker', kind: 'spawn', position: { x: 0, y: 0.04, z: -24.5 }, size: { x: 24, y: 0.08, z: 8 }, color: 0xd93b48 },
  ],
};

export const tacticalMaps = [deathmatch1Map, dockyardMap, rooftopMap] as const;
export const defaultMapId: TacticalMapId = 'deathmatch1';

export const getTacticalMap = (mapId: TacticalMapId | string | undefined): TacticalMapDefinition =>
  tacticalMaps.find((map) => map.id === mapId) ?? deathmatch1Map;
