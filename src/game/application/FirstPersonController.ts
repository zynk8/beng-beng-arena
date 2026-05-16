import { getWeapon } from '../domain/weapons';
import type { InputSnapshot, Vec3 } from '../types/game';
import type { RapierPhysicsWorld } from '../physics/RapierPhysicsWorld';
import type { GameBridge } from '../state/GameBridge';

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const lengthSquared = (value: Vec3): number => dot(value, value);
const addScaled = (origin: Vec3, direction: Vec3, distance: number): Vec3 => ({
  x: origin.x + direction.x * distance,
  y: origin.y + direction.y * distance,
  z: origin.z + direction.z * distance,
});

export class FirstPersonController {
  private position: Vec3;
  private yaw: number;
  private pitch: number;
  private fireCooldownSeconds = 0;
  private reloadTimerSeconds = 0;
  private verticalVelocity = 0;
  private crouchOffset = 0;
  private nextPlayerDamageAtSeconds = 0;
  private wasJumpPressed = false;
  private wasSwitchPrimaryPressed = false;
  private wasSwitchSecondaryPressed = false;
  private wasSwitchKnifePressed = false;
  private wasQuickSwitchPressed = false;
  private wasAddPrimaryAmmoPressed = false;
  private wasAddSecondaryAmmoPressed = false;

  constructor(
    private readonly bridge: GameBridge,
    private readonly physics: RapierPhysicsWorld,
  ) {
    const player = bridge.localPlayer;
    this.position = { ...player.position };
    this.yaw = player.yaw;
    this.pitch = player.pitch;
  }

  update(input: InputSnapshot, deltaSeconds: number): void {
    if (this.bridge.isGameOver || this.bridge.isBuyMenuOpen) {
      return;
    }

    const activeItem = this.bridge.localPlayer.inventory[this.bridge.localPlayer.weaponSlot];
    const weapon = getWeapon(activeItem.weaponId);
    const mouseSensitivity = input.zoomCrosshair ? 0.00135 : 0.0022;
    const moveSpeed = input.crouch ? 2.3 : 5.2;
    const targetCrouchOffset = input.crouch ? 0.62 : 0;

    this.yaw -= input.mouseDeltaX * mouseSensitivity;
    this.pitch = clamp(this.pitch - input.mouseDeltaY * mouseSensitivity, -1.45, 1.45);

    const forward = Number(input.forward) - Number(input.backward);
    const strafe = Number(input.right) - Number(input.left);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    const isGrounded = this.position.y <= 1.801 && this.verticalVelocity <= 0;
    const jumpPressedThisFrame = input.jump && !this.wasJumpPressed;
    if (isGrounded) {
      this.verticalVelocity = 0;
    }

    if (jumpPressedThisFrame && isGrounded) {
      this.verticalVelocity = 5.8;
    }

    this.verticalVelocity -= 18.5 * deltaSeconds;

    const velocity = {
      x: (strafe * cos - forward * sin) * moveSpeed,
      y: this.verticalVelocity,
      z: (forward * cos + strafe * sin) * -moveSpeed,
    };

    const previousY = this.position.y;
    this.position = this.physics.moveCharacter({
      position: this.position,
      velocity,
      deltaSeconds,
    });

    if (this.position.y <= 1.801 && previousY > this.position.y) {
      this.verticalVelocity = 0;
      this.position.y = 1.8;
    }

    this.crouchOffset += (targetCrouchOffset - this.crouchOffset) * Math.min(1, deltaSeconds * 14);
    this.wasJumpPressed = input.jump;
    this.bridge.setZooming(input.zoomCrosshair);
    this.updateReload(deltaSeconds, weapon.reloadSeconds);
    this.handleBuys(input);
    this.handleWeaponKeys(input);

    if (input.reload) {
      this.beginReload();
    }

    this.fireCooldownSeconds = Math.max(0, this.fireCooldownSeconds - deltaSeconds);
    if (input.fire && this.fireCooldownSeconds <= 0 && !this.bridge.localPlayer.isReloading) {
      const player = this.bridge.localPlayer;
      if (player.weaponSlot === 'knife') {
        this.fireCooldownSeconds = weapon.fireCooldownSeconds;
        this.bridge.addKnifeSlashImpulse(1);
        this.shootHitscan(weapon.damage, 2.1);
      } else if (player.ammoInMagazine <= 0) {
        if (player.weaponSlot === 'primary' && player.reserveAmmo <= 0 && player.inventory.secondary.owned) {
          this.bridge.switchWeapon('secondary');
          return;
        }
        this.beginReload();
      } else {
        this.bridge.setAmmo(player.ammoInMagazine - 1, player.reserveAmmo);
        this.fireCooldownSeconds = weapon.fireCooldownSeconds;
        this.bridge.addRecoilImpulse(player.weaponSlot === 'primary' ? 0.58 : 0.34);
        this.shootHitscan(weapon.damage, 80);

        if (player.ammoInMagazine - 1 <= 0) {
          if (player.weaponSlot === 'primary' && player.reserveAmmo <= 0 && player.inventory.secondary.owned) {
            this.bridge.switchWeapon('secondary');
          } else {
            this.beginReload();
          }
        }
      }
    }

    this.bridge.updateEnemyRespawns(performance.now() / 1000);
    this.updateEnemyAi(deltaSeconds);
    const isJumping = !isGrounded;
    this.bridge.setPlayerPose(this.eyePosition(), this.yaw, this.pitch);
    this.bridge.setPlayerPosture(input.crouch, isJumping);
  }

  private handleBuys(input: InputSnapshot): void {
    if (input.buyPrimary) {
      this.bridge.buy('buyPrimary');
    }

    if (input.buySecondary) {
      this.bridge.buy('buySecondary');
    }

    if (input.buyGrenade) {
      this.bridge.buy('buyGrenade');
    }

    if (input.buyKevlar) {
      this.bridge.buy('buyKevlar');
    }
  }

  private handleWeaponKeys(input: InputSnapshot): void {
    if (input.switchPrimary && !this.wasSwitchPrimaryPressed) {
      this.bridge.switchWeapon('primary');
    }

    if (input.switchSecondary && !this.wasSwitchSecondaryPressed) {
      this.bridge.switchWeapon('secondary');
    }

    if (input.switchKnife && !this.wasSwitchKnifePressed) {
      this.bridge.switchWeapon('knife');
    }

    if (input.quickSwitch && !this.wasQuickSwitchPressed) {
      this.bridge.quickSwitchWeapon();
    }

    if (input.addPrimaryAmmo && !this.wasAddPrimaryAmmoPressed) {
      this.bridge.addAmmo('primary');
    }

    if (input.addSecondaryAmmo && !this.wasAddSecondaryAmmoPressed) {
      this.bridge.addAmmo('secondary');
    }

    this.wasSwitchPrimaryPressed = input.switchPrimary;
    this.wasSwitchSecondaryPressed = input.switchSecondary;
    this.wasSwitchKnifePressed = input.switchKnife;
    this.wasQuickSwitchPressed = input.quickSwitch;
    this.wasAddPrimaryAmmoPressed = input.addPrimaryAmmo;
    this.wasAddSecondaryAmmoPressed = input.addSecondaryAmmo;
  }

  private beginReload(): void {
    this.bridge.startReload();
    if (this.bridge.localPlayer.isReloading) {
      this.reloadTimerSeconds = 0;
    }
  }

  private updateReload(deltaSeconds: number, reloadSeconds: number): void {
    if (!this.bridge.localPlayer.isReloading) {
      return;
    }

    this.reloadTimerSeconds += deltaSeconds;
    this.bridge.setReloadProgress(this.reloadTimerSeconds / reloadSeconds);

    if (this.reloadTimerSeconds >= reloadSeconds) {
      this.bridge.finishReload();
      this.reloadTimerSeconds = 0;
    }
  }

  private shootHitscan(damage: number, range: number): void {
    const origin = this.eyePosition();
    const direction = this.forwardDirection();
    let closestEnemyId: string | null = null;
    let closestTargetType: 'bot' | 'remote' = 'bot';
    let closestDistance = Number.POSITIVE_INFINITY;
    let trailEnd = addScaled(origin, direction, range);

    this.bridge.enemies.forEach((enemy) => {
      if (!enemy.alive || enemy.team !== 'enemy') {
        return;
      }

      const toEnemy = subtract(enemy.position, origin);
      const distanceAlongRay = dot(toEnemy, direction);
      if (distanceAlongRay < 0 || distanceAlongRay > range) {
        return;
      }

      const closestPoint = {
        x: origin.x + direction.x * distanceAlongRay,
        y: origin.y + direction.y * distanceAlongRay,
        z: origin.z + direction.z * distanceAlongRay,
      };
      const distanceFromRay = lengthSquared(subtract(enemy.position, closestPoint));
      const hitRadius = 0.72;

      if (distanceFromRay <= hitRadius * hitRadius && distanceAlongRay < closestDistance) {
        closestDistance = distanceAlongRay;
        closestEnemyId = enemy.id;
        closestTargetType = 'bot';
        trailEnd = { x: enemy.position.x, y: enemy.position.y + 1.1, z: enemy.position.z };
      }
    });

    this.bridge.remotePlayers.forEach((player) => {
      if (!player.alive || player.team === this.bridge.localTeam) {
        return;
      }

      const toEnemy = subtract(player.position, origin);
      const distanceAlongRay = dot(toEnemy, direction);
      if (distanceAlongRay < 0 || distanceAlongRay > range) {
        return;
      }

      const closestPoint = {
        x: origin.x + direction.x * distanceAlongRay,
        y: origin.y + direction.y * distanceAlongRay,
        z: origin.z + direction.z * distanceAlongRay,
      };
      const distanceFromRay = lengthSquared(subtract(player.position, closestPoint));
      const hitRadius = 0.82;

      if (distanceFromRay <= hitRadius * hitRadius && distanceAlongRay < closestDistance) {
        closestDistance = distanceAlongRay;
        closestEnemyId = player.id;
        closestTargetType = 'remote';
        trailEnd = { x: player.position.x, y: player.position.y, z: player.position.z };
      }
    });

    if (range > 3) {
      this.bridge.recordBulletTrail(
        addScaled(origin, direction, 1.2),
        trailEnd,
        this.bridge.localTeam,
      );
    }

    if (closestEnemyId) {
      if (closestTargetType === 'bot') {
        this.bridge.damageEnemy(closestEnemyId, damage);
      } else {
        this.bridge.damageRemotePlayer(closestEnemyId, damage);
      }
    }
  }

  private forwardDirection(): Vec3 {
    const cosPitch = Math.cos(this.pitch);

    return {
      x: -Math.sin(this.yaw) * cosPitch,
      y: Math.sin(this.pitch),
      z: -Math.cos(this.yaw) * cosPitch,
    };
  }

  private eyePosition(): Vec3 {
    return {
      x: this.position.x,
      y: Math.max(1.05, this.position.y - this.crouchOffset),
      z: this.position.z,
    };
  }

  private updateEnemyAi(deltaSeconds: number): void {
    if (this.bridge.remotePlayers.length > 0) {
      return;
    }

    const nowSeconds = performance.now() / 1000;
    const playerPosition = this.position;

    this.bridge.enemies.forEach((enemy) => {
      if (!enemy.alive || enemy.team !== 'enemy') {
        return;
      }

      const toPlayer = subtract(playerPosition, enemy.position);
      const flatDistance = Math.hypot(toPlayer.x, toPlayer.z);
      const directionToPlayer = flatDistance > 0.001
        ? { x: toPlayer.x / flatDistance, y: 0, z: toPlayer.z / flatDistance }
        : { x: 0, y: 0, z: 0 };
      const strafe = { x: -directionToPlayer.z * enemy.strafeDirection, y: 0, z: directionToPlayer.x * enemy.strafeDirection };
      const desiredRange = 13;
      const chaseSpeed = flatDistance > desiredRange + 1.5 ? 1.35 : flatDistance < 8 ? -0.85 : 0;
      const strafeSpeed = flatDistance < 24 ? 0.9 : 0.2;
      const velocity = {
        x: directionToPlayer.x * chaseSpeed + strafe.x * strafeSpeed,
        y: 0,
        z: directionToPlayer.z * chaseSpeed + strafe.z * strafeSpeed,
      };
      const nextPosition = this.physics.moveEnemy({
        position: enemy.position,
        velocity,
        deltaSeconds,
      });

      this.bridge.moveEnemy(enemy.id, nextPosition);

      const canShoot = flatDistance < 22 && nowSeconds >= enemy.nextShotAtSeconds;
      if (canShoot) {
        this.bridge.setEnemyAiState(enemy.id, 'shoot', nowSeconds + 0.5);
        const shotOrigin = { x: enemy.position.x, y: enemy.position.y + 1.25, z: enemy.position.z };
        const shotTarget = { x: playerPosition.x, y: playerPosition.y - 0.15, z: playerPosition.z };
        this.bridge.recordBulletTrail(shotOrigin, shotTarget, 'enemy');
        const accuracy = flatDistance < 10 ? 0.16 : flatDistance < 18 ? 0.1 : 0.045;
        if (nowSeconds >= this.nextPlayerDamageAtSeconds && Math.random() < accuracy) {
          const damage = flatDistance < 10 ? 1.4 : 0.8;
          this.bridge.damagePlayer(damage);
          this.nextPlayerDamageAtSeconds = nowSeconds + 1.25;
        }

        this.bridge.setEnemyNextShot(enemy.id, nowSeconds + 4.2 + Math.random() * 2.8);
      } else if (nowSeconds >= enemy.stateUntilSeconds) {
        this.bridge.setEnemyAiState(enemy.id, flatDistance > desiredRange + 1.5 ? 'run' : 'idle');
      }
    });
  }
}
