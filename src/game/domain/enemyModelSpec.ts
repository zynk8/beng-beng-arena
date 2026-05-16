export const enemyModelSpec = {
  glbPath: '/assets/neon_chrome_soldier.glb',
  fallbackSpriteSheets: {
    green: '/assets/army_sprites.png',
    dark: '/assets/army2_sprites.png',
  },
  scale: 1,
  height: 1.8,
  rapierCapsule: {
    radius: 0.5,
    halfHeight: 0.9,
  },
  healthEmissive: {
    healthy: 0x33fff2,
    damaged: 0xff8a24,
  },
  clips: {
    idle: 'Idle',
    run: 'Run',
    shoot: 'Shoot',
    crouch: 'Crouch_Walk',
    death: 'Impact_Death',
  },
} as const;
