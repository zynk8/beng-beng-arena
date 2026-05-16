import RAPIER from '@dimforge/rapier3d-compat';
import type { MapBlock, TacticalMapDefinition } from '../domain/deathmatch1Map';
import type { Disposable, Vec3 } from '../types/game';

export interface CharacterMoveRequest {
  position: Vec3;
  velocity: Vec3;
  deltaSeconds: number;
}

export class RapierPhysicsWorld implements Disposable {
  private readonly world: RAPIER.World;
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly solidBlocks: MapBlock[];

  private constructor(world: RAPIER.World, map: TacticalMapDefinition) {
    this.world = world;
    this.solidBlocks = map.blocks.filter((block) => ['wall', 'cover', 'crate'].includes(block.kind));
    this.controller = world.createCharacterController(0.01);
    this.controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    this.controller.enableSnapToGround(0.5);
  }

  static async create(map: TacticalMapDefinition): Promise<RapierPhysicsWorld> {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        map.floorSize.x / 2,
        map.floorSize.y / 2,
        map.floorSize.z / 2,
      ),
      floorBody,
    );

    map.blocks
      .filter((block) => block.kind !== 'spawn')
      .forEach((block) => {
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(
            block.position.x,
            block.position.y,
            block.position.z,
          ),
        );

        world.createCollider(
          RAPIER.ColliderDesc.cuboid(block.size.x / 2, block.size.y / 2, block.size.z / 2),
          body,
        );
      });

    return new RapierPhysicsWorld(world, map);
  }

  moveCharacter({ position, velocity, deltaSeconds }: CharacterMoveRequest): Vec3 {
    this.world.timestep = deltaSeconds;
    this.world.step();

    return this.movePoint(position, velocity, deltaSeconds, 0.35, 1.8);
  }

  moveEnemy({ position, velocity, deltaSeconds }: CharacterMoveRequest): Vec3 {
    return this.movePoint(position, velocity, deltaSeconds, 0.42, 1);
  }

  private movePoint(
    position: Vec3,
    velocity: Vec3,
    deltaSeconds: number,
    radius: number,
    minY: number,
  ): Vec3 {
    const next = {
      x: position.x + velocity.x * deltaSeconds,
      y: Math.max(minY, position.y + velocity.y * deltaSeconds),
      z: position.z + velocity.z * deltaSeconds,
    };

    const xResolved = this.overlapsSolid({ ...position, x: next.x }, radius) ? position.x : next.x;
    const zResolved = this.overlapsSolid({ ...position, x: xResolved, z: next.z }, radius) ? position.z : next.z;

    return { x: xResolved, y: next.y, z: zResolved };
  }

  dispose(): void {
    this.world.free();
  }

  private overlapsSolid(position: Vec3, radius: number): boolean {
    return this.solidBlocks.some((block) => this.overlapsBlock(position, radius, block));
  }

  private overlapsBlock(position: Vec3, radius: number, block: MapBlock): boolean {
    const minX = block.position.x - block.size.x / 2 - radius;
    const maxX = block.position.x + block.size.x / 2 + radius;
    const minZ = block.position.z - block.size.z / 2 - radius;
    const maxZ = block.position.z + block.size.z / 2 + radius;

    return position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ;
  }
}
