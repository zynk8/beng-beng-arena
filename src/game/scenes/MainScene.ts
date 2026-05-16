import Phaser from 'phaser';
import { FirstPersonController } from '../application/FirstPersonController';
import { getWeapon } from '../domain/weapons';
import { PointerLockInput } from '../input/PointerLockInput';
import { RapierPhysicsWorld } from '../physics/RapierPhysicsWorld';
import { PhaserThreeRenderNode, registerThreeRenderNode } from '../rendering/PhaserThreeRenderNode';
import { ThreeWorldRenderer } from '../rendering/ThreeWorldRenderer';
import type { GameBridge } from '../state/GameBridge';
import type { Disposable } from '../types/game';

export interface MainSceneConfig {
  bridge: GameBridge;
  threeHost: HTMLElement;
  lockTarget: HTMLElement;
}

export class MainScene extends Phaser.Scene {
  private readonly disposables: Disposable[] = [];
  private readonly crosshairLines: Phaser.GameObjects.Rectangle[] = [];
  private readonly scopeLines: Phaser.GameObjects.Rectangle[] = [];
  private readonly scopeRings: Phaser.GameObjects.Arc[] = [];
  private readonly sparkLines: Phaser.GameObjects.Rectangle[] = [];
  private sparkRing?: Phaser.GameObjects.Arc;
  private sparkLife = 0;
  private threeRenderer?: ThreeWorldRenderer;
  private inputAdapter?: PointerLockInput;
  private fpsController?: FirstPersonController;
  private physicsWorld?: RapierPhysicsWorld;
  private accumulatorSeconds = 0;

  constructor(private readonly tacticalConfig: MainSceneConfig) {
    super('MainScene');
  }

  async create(): Promise<void> {
    this.physicsWorld = await RapierPhysicsWorld.create(this.tacticalConfig.bridge.map);
    this.threeRenderer = new ThreeWorldRenderer(this.tacticalConfig.threeHost, this.tacticalConfig.bridge);
    this.inputAdapter = new PointerLockInput(this.tacticalConfig.lockTarget, (locked) => {
      this.tacticalConfig.bridge.setPointerLocked(locked);
    }, () => this.tacticalConfig.bridge.keyBindings);
    this.fpsController = new FirstPersonController(this.tacticalConfig.bridge, this.physicsWorld);

    this.disposables.push(this.inputAdapter, this.threeRenderer, this.physicsWorld);

    const renderNode = new PhaserThreeRenderNode(this.threeRenderer);
    registerThreeRenderNode(this.game, renderNode);

    this.add.rectangle(0, 0, 1, 1, 0x000000, 0);
    this.createPhaserOverlay();
  }

  update(_: number, deltaMs: number): void {
    if (!this.inputAdapter || !this.fpsController || !this.threeRenderer) {
      return;
    }

    const fixedStep = 1 / 128;
    const isMatchActive = this.tacticalConfig.bridge.phase === 'loading' || this.tacticalConfig.bridge.phase === 'playing';
    const input = this.inputAdapter.consumeFrameInput();

    if (isMatchActive) {
      this.accumulatorSeconds += Math.min(deltaMs / 1000, 0.05);

      while (this.accumulatorSeconds >= fixedStep) {
        this.fpsController.update(input, fixedStep);
        this.accumulatorSeconds -= fixedStep;
      }
    } else {
      this.accumulatorSeconds = 0;
    }

    const recoilImpulse = this.tacticalConfig.bridge.localPlayer.recoilImpulse;
    if (recoilImpulse > 0.02) {
      this.triggerCrosshairSpark(recoilImpulse);
    }

    this.threeRenderer.render();
    this.updateCrosshair();
    this.updateCrosshairSpark(deltaMs / 1000);
  }

  destroy(): void {
    this.disposables.forEach((item) => item.dispose());
    this.disposables.length = 0;
  }

  private createPhaserOverlay(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const lineSize = 8;
    const gap = 6;
    const color = 0xf1f5ee;

    this.crosshairLines.push(
      this.add.rectangle(width / 2 - gap - lineSize / 2, height / 2, lineSize, 2, color, 0.9),
      this.add.rectangle(width / 2 + gap + lineSize / 2, height / 2, lineSize, 2, color, 0.9),
      this.add.rectangle(width / 2, height / 2 - gap - lineSize / 2, 2, lineSize, color, 0.9),
      this.add.rectangle(width / 2, height / 2 + gap + lineSize / 2, 2, lineSize, color, 0.9),
    );

    this.scopeRings.push(
      this.add.circle(width / 2, height / 2, 155, 0x000000, 0).setStrokeStyle(5, 0xff7a2f, 0),
      this.add.circle(width / 2, height / 2, 92, 0x000000, 0).setStrokeStyle(3, 0xb338ff, 0),
    );

    this.scopeLines.push(
      this.add.rectangle(width / 2, height / 2 - 155, 6, 92, 0xffa12c, 0),
      this.add.rectangle(width / 2 + 155, height / 2, 92, 6, 0xffa12c, 0),
      this.add.rectangle(width / 2, height / 2 + 155, 6, 92, 0xffa12c, 0),
      this.add.rectangle(width / 2 - 155, height / 2, 92, 6, 0xffa12c, 0),
      this.add.rectangle(width / 2, height / 2 - 34, 2, 34, 0xd9ff30, 0),
      this.add.rectangle(width / 2 + 34, height / 2, 34, 2, 0xd9ff30, 0),
      this.add.rectangle(width / 2, height / 2 + 34, 2, 34, 0xd9ff30, 0),
      this.add.rectangle(width / 2 - 34, height / 2, 34, 2, 0xd9ff30, 0),
      this.add.rectangle(width / 2, height / 2, 3, 3, 0xff3b2f, 0),
    );

    this.scopeLines.forEach((line, index) => {
      line.setBlendMode(index < 4 ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    });

    this.sparkRing = this.add
      .circle(width / 2, height / 2, 18, 0x000000, 0)
      .setStrokeStyle(3, 0xffd166, 0)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.sparkLines.push(
      this.add.rectangle(width / 2, height / 2 - 18, 3, 16, 0xff4655, 0),
      this.add.rectangle(width / 2 + 18, height / 2, 16, 3, 0xffd166, 0),
      this.add.rectangle(width / 2, height / 2 + 18, 3, 16, 0x59d5ff, 0),
      this.add.rectangle(width / 2 - 18, height / 2, 16, 3, 0xffd166, 0),
    );

    this.sparkLines.forEach((line) => {
      line.setBlendMode(Phaser.BlendModes.ADD);
    });

    this.add
      .rectangle(92, 92, 112, 112, 0x101716, 0.62)
      .setStrokeStyle(1, 0x88fff0, 0.35);
    this.add.circle(92, 92, 4, 0x88fff0, 1);
  }

  private updateCrosshair(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const player = this.tacticalConfig.bridge.localPlayer;
    const activeItem = player.inventory[player.weaponSlot];
    const activeWeapon = getWeapon(activeItem.weaponId);
    const shouldUseBigScope = player.isZooming && (activeWeapon.id === 'awp' || activeWeapon.damage >= 80);
    const lineSize = player.isZooming ? 6 : 8;
    const gap = player.isZooming ? 2.5 : 6;
    const positions = [
      { x: width / 2 - gap - lineSize / 2, y: height / 2, width: lineSize, height: 2 },
      { x: width / 2 + gap + lineSize / 2, y: height / 2, width: lineSize, height: 2 },
      { x: width / 2, y: height / 2 - gap - lineSize / 2, width: 2, height: lineSize },
      { x: width / 2, y: height / 2 + gap + lineSize / 2, width: 2, height: lineSize },
    ];

    this.crosshairLines.forEach((line, index) => {
      const position = positions[index];
      line.setPosition(position.x, position.y);
      line.setSize(position.width, position.height);
      line.setAlpha(shouldUseBigScope ? 0 : player.isZooming ? 1 : 0.9);
    });

    const radius = Math.min(width, height) * 0.23;
    const innerRadius = radius * 0.6;
    this.scopeRings[0]?.setPosition(width / 2, height / 2).setRadius(radius).setStrokeStyle(5, 0xff7a2f, shouldUseBigScope ? 0.96 : 0);
    this.scopeRings[1]?.setPosition(width / 2, height / 2).setRadius(innerRadius).setStrokeStyle(3, 0xb338ff, shouldUseBigScope ? 0.74 : 0);

    const scopePositions = [
      { x: width / 2, y: height / 2 - radius, width: 6, height: radius * 0.58, color: 0xffa12c },
      { x: width / 2 + radius, y: height / 2, width: radius * 0.58, height: 6, color: 0xffa12c },
      { x: width / 2, y: height / 2 + radius, width: 6, height: radius * 0.58, color: 0xffa12c },
      { x: width / 2 - radius, y: height / 2, width: radius * 0.58, height: 6, color: 0xffa12c },
      { x: width / 2, y: height / 2 - 34, width: 2, height: 34, color: 0xd9ff30 },
      { x: width / 2 + 34, y: height / 2, width: 34, height: 2, color: 0xd9ff30 },
      { x: width / 2, y: height / 2 + 34, width: 2, height: 34, color: 0xd9ff30 },
      { x: width / 2 - 34, y: height / 2, width: 34, height: 2, color: 0xd9ff30 },
      { x: width / 2, y: height / 2, width: 3, height: 3, color: 0xff3b2f },
    ];

    this.scopeLines.forEach((line, index) => {
      const position = scopePositions[index];
      line.setPosition(position.x, position.y);
      line.setSize(position.width, position.height);
      line.setFillStyle(position.color, shouldUseBigScope ? (index < 4 ? 0.95 : 1) : 0);
    });
  }

  private triggerCrosshairSpark(amount: number): void {
    this.sparkLife = Math.min(1, Math.max(this.sparkLife, 0.45 + amount * 0.55));
  }

  private updateCrosshairSpark(deltaSeconds: number): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const centerY = height / 2;

    this.sparkLife = Math.max(0, this.sparkLife - deltaSeconds * 5.8);
    const alpha = Math.min(1, this.sparkLife);
    const spread = 13 + alpha * 22;
    const size = 9 + alpha * 14;

    this.sparkRing?.setPosition(centerX, centerY);
    this.sparkRing?.setRadius(9 + alpha * 18);
    this.sparkRing?.setStrokeStyle(2 + alpha * 3, 0xffd166, alpha * 0.74);

    const positions = [
      { x: centerX, y: centerY - spread, width: 3, height: size, rotation: 0 },
      { x: centerX + spread, y: centerY, width: size, height: 3, rotation: 0 },
      { x: centerX, y: centerY + spread, width: 3, height: size, rotation: 0 },
      { x: centerX - spread, y: centerY, width: size, height: 3, rotation: 0 },
    ];

    this.sparkLines.forEach((line, index) => {
      const position = positions[index];
      line.setPosition(position.x, position.y);
      line.setSize(position.width, position.height);
      line.setAlpha(alpha);
    });
  }
}
