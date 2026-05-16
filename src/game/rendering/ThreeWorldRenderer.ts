import * as THREE from 'three';
import { getWeapon } from '../domain/weapons';
import type { BulletTrailSnapshot, Disposable, EnemyAiState, Vec3, WeaponDefinition, WeaponId } from '../types/game';
import type { GameBridge } from '../state/GameBridge';

interface SpriteFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ENEMY_FRAME_WIDTH = 190;
const ENEMY_FRAME_HEIGHT = 210;

interface SpriteAnimation {
  texture: THREE.CanvasTexture;
  frameCount: number;
}

interface EnemySpriteView {
  sprite: THREE.Sprite;
  animations: Record<EnemyAiState, SpriteAnimation>;
  activeState: EnemyAiState;
}

interface EnemyModelView {
  root: THREE.Group;
  bodyRoot: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  armorMaterial: THREE.MeshStandardMaterial;
  visorMaterial: THREE.MeshStandardMaterial;
  rifle: THREE.Group;
  muzzleFlash: THREE.Sprite;
  tracer: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  label: THREE.Sprite;
}

interface BulletTrailView {
  mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
}

interface WeaponSkinPalette {
  main: number;
  secondary: number;
  glow: number;
}

export class ThreeWorldRenderer implements Disposable {
  readonly renderer: THREE.WebGLRenderer;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(75, 1, 0.05, 1000);
  private readonly viewmodelScene = new THREE.Scene();
  private readonly viewmodelCamera = new THREE.PerspectiveCamera(65, 1, 0.01, 10);
  private readonly disposables: Disposable[] = [];
  private readonly enemySprites = new Map<string, EnemySpriteView>();
  private readonly enemyModels = new Map<string, EnemyModelView>();
  private readonly remotePlayerModels = new Map<string, EnemyModelView>();
  private readonly bulletTrailViews = new Map<string, BulletTrailView>();
  private readonly viewmodelRoot = new THREE.Group();
  private readonly weaponModelRoot = new THREE.Group();
  private readonly remotePlayerRoot = new THREE.Group();
  private muzzleFlash?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private knifeSlash?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly muzzleSparks: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly resizeObserver: ResizeObserver;
  private recoilKick = 0;
  private recoilReturn = 0;
  private flashLife = 0;
  private knifeSlashLife = 0;
  private displayedWeaponId: WeaponId | null = null;
  private weaponImageRequest = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly bridge: GameBridge,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.domElement.className = 'three-canvas';
    this.host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xcdbdc1);
    this.scene.fog = new THREE.Fog(0xcdbdc1, 42, 110);
    const map = this.bridge.map;
    this.camera.position.set(map.playerStart.x, map.playerStart.y, map.playerStart.z);
    this.viewmodelCamera.position.set(0, 0, 0);

    this.createPrototypeMap();
    this.createEnemies();
    this.createSecondPersonPlayer();
    this.createPrototypeViewmodel();
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.host);
    this.resize();
  }

  render(): void {
    const player = this.bridge.localPlayer;
    this.camera.position.set(player.position.x, player.position.y, player.position.z);
    this.camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    const targetFov = player.isZooming ? 52 : 75;
    this.camera.fov += (targetFov - this.camera.fov) * 0.22;
    this.camera.updateProjectionMatrix();
    this.syncWeaponViewmodel();
    this.updateViewmodelRecoil();
    this.animateSecondPerson();
    this.syncEnemies();
    this.syncRemotePlayers();
    this.syncBulletTrails();

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.viewmodelScene, this.viewmodelCamera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.bulletTrailViews.forEach((view) => {
      view.mesh.geometry.dispose();
      view.mesh.material.dispose();
    });
    this.bulletTrailViews.clear();
    this.disposables.forEach((item) => item.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private createPrototypeMap(): void {
    const map = this.bridge.map;
    const hemiLight = new THREE.HemisphereLight(0xfff2e8, 0x58423a, 1.35);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.55);
    keyLight.position.set(-4, 8, 6);
    const fillLight = new THREE.DirectionalLight(0xffd6a6, 1.15);
    fillLight.position.set(8, 5, -10);

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xb8785e, roughness: 0.96, metalness: 0.01, flatShading: true });
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(map.floorSize.x, map.floorSize.y, map.floorSize.z),
      floorMaterial,
    );
    floor.position.y = -0.1;

    const grid = new THREE.GridHelper(
      Math.max(map.floorSize.x, map.floorSize.z),
      32,
      0xd59573,
      0xa76c55,
    );
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0.2;

    this.scene.add(hemiLight, keyLight, fillLight, floor, grid);
    this.disposables.push(floor.geometry, floorMaterial);

    map.blocks.forEach((block) => {
      const material = new THREE.MeshStandardMaterial({
        color: block.color,
        roughness: block.kind === 'crate' ? 0.58 : 0.82,
        metalness: block.kind === 'spawn' ? 0.16 : 0.04,
        emissive: block.kind === 'spawn' ? block.color : 0x000000,
        emissiveIntensity: block.kind === 'spawn' ? 0.34 : 0,
        transparent: block.kind === 'spawn',
        opacity: block.kind === 'spawn' ? 0.78 : 1,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(block.size.x, block.size.y, block.size.z), material);
      mesh.position.set(block.position.x, block.position.y, block.position.z);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.disposables.push(mesh.geometry, material);

      if (block.kind === 'crate' || block.kind === 'cover' || block.kind === 'spawn') {
        const edges = new THREE.EdgesGeometry(mesh.geometry);
        const edgeColor = block.kind === 'spawn' ? block.color : block.kind === 'cover' ? 0xff4655 : 0x14100d;
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.72 }));
        line.position.copy(mesh.position);
        this.scene.add(line);
        this.disposables.push(edges, line.material);
      }
    });

    this.createLaneLabels();
    this.createArenaSetDressing();
    this.createBlockCityBackdrop();
  }

  private createLaneLabels(): void {
    const labelMaterial = new THREE.MeshBasicMaterial({ color: 0xff4655, transparent: true, opacity: 0.72 });
    const markerGeometry = new THREE.PlaneGeometry(2.2, 0.08);
    const markerPositions = [
      new THREE.Vector3(-20, 0.015, -8),
      new THREE.Vector3(20, 0.015, -8),
      new THREE.Vector3(0, 0.015, 3),
    ];

    markerPositions.forEach((position) => {
      const marker = new THREE.Mesh(markerGeometry.clone(), labelMaterial.clone());
      marker.position.copy(position);
      marker.rotation.x = -Math.PI / 2;
      this.scene.add(marker);
      this.disposables.push(marker.geometry, marker.material);
    });
  }

  private createArenaSetDressing(): void {
    const stripGeometry = new THREE.PlaneGeometry(8, 0.12);
    const blueStrip = new THREE.MeshBasicMaterial({ color: 0x59d5ff, transparent: true, opacity: 0.82, toneMapped: false });
    const redStrip = new THREE.MeshBasicMaterial({ color: 0xff4655, transparent: true, opacity: 0.82, toneMapped: false });
    const amberStrip = new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.58, toneMapped: false });
    const strips = [
      { x: -10, z: 21, rotation: 0, material: blueStrip },
      { x: 10, z: 21, rotation: 0, material: blueStrip },
      { x: -10, z: -21, rotation: 0, material: redStrip },
      { x: 10, z: -21, rotation: 0, material: redStrip },
      { x: 0, z: 0, rotation: Math.PI / 2, material: amberStrip },
    ];

    strips.forEach((strip) => {
      const mesh = new THREE.Mesh(stripGeometry.clone(), strip.material);
      mesh.position.set(strip.x, 0.026, strip.z);
      mesh.rotation.set(-Math.PI / 2, 0, strip.rotation);
      this.scene.add(mesh);
      this.disposables.push(mesh.geometry);
    });
    this.disposables.push(blueStrip, redStrip, amberStrip);

    this.createGroundLabel('BLUE BASE', 0x59d5ff, -12, 24.6, 0);
    this.createGroundLabel('RED BASE', 0xff4655, 12, -24.6, Math.PI);
    this.createWallSign('BENG BENG', 'ARENA', 0xff4655, 0, 3.45, -31.66, 0);
    this.createWallSign('BUY ZONE', 'ARMORY', 0x59d5ff, -18, 2.6, 31.66, Math.PI);
    this.createWallSign('FIRST KILL', 'WINS', 0xffc857, 18, 2.6, 31.66, Math.PI);
    this.createAccentLight(0x59d5ff, -10, 3, 23);
    this.createAccentLight(0xff4655, 10, 3, -23);
    this.createPropBarrels();
  }

  private createGroundLabel(text: string, color: number, x: number, z: number, rotation: number): void {
    const texture = this.createTextTexture(text, color, '#0a1012', 512, 128);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.86, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.35), material);
    mesh.position.set(x, 0.032, z);
    mesh.rotation.set(-Math.PI / 2, 0, rotation);
    this.scene.add(mesh);
    this.disposables.push(texture, material, mesh.geometry);
  }

  private createWallSign(title: string, subtitle: string, color: number, x: number, y: number, z: number, rotationY: number): void {
    const texture = this.createTextTexture(`${title}\n${subtitle}`, color, '#101518', 512, 256);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.2), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    this.scene.add(mesh);
    this.disposables.push(texture, material, mesh.geometry);
  }

  private createTextTexture(text: string, color: number, background: string, width: number, height: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const lines = text.split('\n');

    if (context) {
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
      context.lineWidth = 8;
      context.strokeRect(8, 8, width - 16, height - 16);
      context.fillStyle = '#f7f1e8';
      context.font = `900 ${lines.length > 1 ? 62 : 58}px Arial`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      lines.forEach((line, index) => {
        context.fillText(line, width / 2, height / 2 + (index - (lines.length - 1) / 2) * 68);
      });
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createAccentLight(color: number, x: number, y: number, z: number): void {
    const light = new THREE.PointLight(color, 1.8, 17);
    light.position.set(x, y, z);
    this.scene.add(light);
  }

  private createPropBarrels(): void {
    const positions = [
      { x: -24, z: 17, color: 0x59d5ff },
      { x: -22.5, z: 17.8, color: 0xffc857 },
      { x: 23.5, z: -17.5, color: 0xff4655 },
      { x: 22, z: -18.5, color: 0xffc857 },
    ];

    positions.forEach((item) => {
      const material = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.62, metalness: 0.18 });
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.1, 16), material);
      barrel.position.set(item.x, 0.55, item.z);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0x101518 }));
      band.position.y = 0.24;
      barrel.add(band);
      this.scene.add(barrel);
      this.disposables.push(barrel.geometry, material, band.geometry, band.material);
    });
  }

  private createBlockCityBackdrop(): void {
    const buildings = [
      { x: -38, z: -18, w: 9, h: 10, d: 12, color: 0x8f8987 },
      { x: -39, z: 4, w: 8, h: 7, d: 13, color: 0x6d7379 },
      { x: -37, z: 24, w: 10, h: 8, d: 10, color: 0x9b755d },
      { x: 38, z: -24, w: 11, h: 11, d: 12, color: 0x46505d },
      { x: 39, z: -2, w: 8, h: 8, d: 13, color: 0x7b6f6d },
      { x: 37, z: 22, w: 10, h: 7, d: 12, color: 0x9a765c },
      { x: -16, z: -40, w: 13, h: 9, d: 8, color: 0x6b7178 },
      { x: 8, z: -41, w: 11, h: 12, d: 8, color: 0x8b8585 },
      { x: 24, z: 40, w: 14, h: 8, d: 8, color: 0x9b7358 },
      { x: -22, z: 40, w: 10, h: 7, d: 8, color: 0x59636c },
    ];

    buildings.forEach((item, index) => {
      const material = new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.92, flatShading: true });
      const building = new THREE.Mesh(new THREE.BoxGeometry(item.w, item.h, item.d), material);
      building.position.set(item.x, item.h / 2 - 0.1, item.z);
      this.scene.add(building);
      this.disposables.push(building.geometry, material);

      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(item.w * 0.65, 0.45, 0.08),
        new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? 0x59d5ff : 0xffc857 }),
      );
      accent.position.set(item.x, item.h * 0.62, item.z + (item.z < 0 ? item.d / 2 + 0.045 : -item.d / 2 - 0.045));
      this.scene.add(accent);
      this.disposables.push(accent.geometry, accent.material);
    });

    const vanMaterial = new THREE.MeshStandardMaterial({ color: 0xe8dfcf, roughness: 0.8, flatShading: true });
    const glassMaterial = new THREE.MeshBasicMaterial({ color: 0x1f2a32 });
    const van = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.35, 2.15), vanMaterial);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1, 2), vanMaterial);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.58, 1.55), glassMaterial);
    body.position.y = 0.82;
    cabin.position.set(1.2, 1.35, 0);
    windshield.position.set(1.95, 1.42, 0);
    van.add(body, cabin, windshield);
    van.position.set(-23, 0, 23);
    van.rotation.y = -0.32;
    this.scene.add(van);
    this.disposables.push(body.geometry, cabin.geometry, windshield.geometry, vanMaterial, glassMaterial);
  }

  private createPrototypeViewmodel(): void {
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(2, 2, 2);

    this.viewmodelRoot.position.set(0, 0, 0);
    this.viewmodelRoot.add(this.weaponModelRoot);
    this.viewmodelScene.add(light, this.viewmodelRoot);
    this.syncWeaponViewmodel();
    this.createMuzzleFlash();
    this.createKnifeSlash();
  }

  private createArmyImageViewmodel(): void {
    const image = new Image();
    image.onload = () => {
      const texture = this.createChromaKeyTexture(image);
      const aspect = image.naturalWidth / image.naturalHeight;
      const geometry = new THREE.PlaneGeometry(1.55 * aspect, 1.55);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const weaponImage = new THREE.Mesh(geometry, material);
      weaponImage.position.set(0.86, -0.84, -2.45);
      weaponImage.renderOrder = 1000;
      this.viewmodelRoot.add(weaponImage);
      this.disposables.push(geometry, material, texture);
    };
    image.src = '/assets/army.png';
  }

  private syncWeaponViewmodel(): void {
    const activeItem = this.bridge.localPlayer.inventory[this.bridge.localPlayer.weaponSlot];
    if (activeItem.weaponId === this.displayedWeaponId) {
      return;
    }

    this.displayedWeaponId = activeItem.weaponId;
    this.weaponImageRequest += 1;
    this.weaponModelRoot.clear();
    this.weaponModelRoot.position.set(0.38, -0.42, -1.32);
    this.weaponModelRoot.rotation.set(-0.08, -0.18, 0.02);

    const weapon = getWeapon(activeItem.weaponId);
    if (weapon.slot === 'knife') {
      this.createKnifeViewmodel();
      return;
    }

    if (weapon.slot === 'secondary') {
      this.createPistolViewmodel(activeItem.weaponId);
      return;
    }

    this.createRifleViewmodel(activeItem.weaponId);
  }

  private createImageWeaponViewmodel(weapon: WeaponDefinition, requestId: number): void {
    const image = new Image();
    image.onload = () => {
      if (requestId !== this.weaponImageRequest || this.displayedWeaponId !== weapon.id) {
        return;
      }

      const texture = this.createChromaKeyTexture(image);
      const aspect = image.naturalWidth / image.naturalHeight;
      const height = weapon.slot === 'primary' ? 1.34 : 1.42;
      const geometry = new THREE.PlaneGeometry(height * aspect, height);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const weaponImage = new THREE.Mesh(geometry, material);
      weaponImage.position.set(weapon.slot === 'primary' ? 0.18 : 0, weapon.slot === 'primary' ? -0.03 : -0.03, -0.9);
      weaponImage.rotation.set(0.01, 0, 0);
      weaponImage.renderOrder = 1000;
      this.weaponModelRoot.position.set(
        weapon.slot === 'primary' ? 0.5 : 0,
        weapon.slot === 'primary' ? -0.52 : -0.48,
        weapon.slot === 'primary' ? -1.5 : -1.62,
      );
      this.weaponModelRoot.rotation.set(-0.02, 0, 0);
      this.weaponModelRoot.add(weaponImage);
      this.disposables.push(geometry, material, texture);
    };
    image.src = weapon.firstPersonImagePath ?? '';
  }

  private weaponSkinPalette(weaponId: WeaponId): WeaponSkinPalette {
    const skins: Partial<Record<WeaponId, WeaponSkinPalette>> = {
      m4a1: { main: 0x2ee6ff, secondary: 0xf6f6f0, glow: 0xffd84f },
      ak47: { main: 0xff3048, secondary: 0xf6f6f0, glow: 0x1ef0a4 },
      famas: { main: 0x4d63ff, secondary: 0xfff04a, glow: 0xff4fe8 },
      galil: { main: 0x2df27f, secondary: 0x222a35, glow: 0xfff04a },
      awp: { main: 0xeef7ff, secondary: 0x51d6ff, glow: 0xffd84f },
      glock: { main: 0x88a0ff, secondary: 0xf6f6f0, glow: 0xffd84f },
      usp: { main: 0x39e6d2, secondary: 0x202733, glow: 0xfff04a },
      deagle: { main: 0xffc84a, secondary: 0x2a2521, glow: 0xff4f4f },
    };

    return skins[weaponId] ?? { main: 0x59656d, secondary: 0xf6f6f0, glow: 0xffd84f };
  }

  private addWeaponOutlines(parts: THREE.Object3D[]): void {
    parts.forEach((part) => {
      if (!(part instanceof THREE.Mesh) || !(part.geometry instanceof THREE.BufferGeometry)) {
        return;
      }

      const edges = new THREE.EdgesGeometry(part.geometry, 25);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: 0x050505,
          transparent: true,
          opacity: 0.72,
          depthTest: false,
          depthWrite: false,
        }),
      );
      line.renderOrder = 1003;
      part.add(line);
      this.disposables.push(edges, line.material);
    });
  }

  private createStylizedWeaponPlane(weaponId: WeaponId, slot: 'primary' | 'secondary'): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 360;
    const context = canvas.getContext('2d');
    const palette = this.weaponSkinPalette(weaponId);

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.lineJoin = 'round';
      context.lineCap = 'round';
      if (slot === 'primary') {
        this.drawStylizedRifle(context, weaponId, palette);
      } else {
        this.drawStylizedPistol(context, weaponId, palette);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const planeWidth = slot === 'primary' ? 1.95 : 1.18;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeWidth * 0.4), material);
    plane.position.set(slot === 'primary' ? 0.02 : 0.04, slot === 'primary' ? 0.02 : -0.02, -0.68);
    plane.renderOrder = 1005;
    this.disposables.push(texture, material, plane.geometry);
    return plane;
  }

  private createRealisticMarkings(weaponId: WeaponId, slot: 'primary' | 'secondary'): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 220;
    const context = canvas.getContext('2d');

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = 'rgba(210, 218, 212, 0.22)';
      context.font = '900 28px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(weaponId.toUpperCase(), 350, 104);
      context.fillStyle = 'rgba(255, 255, 255, 0.12)';
      context.fillRect(210, 130, 280, 4);
      context.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let index = 0; index < 7; index += 1) {
        context.fillRect(230 + index * 38, 78, 18, 6);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.76,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const width = slot === 'primary' ? 0.86 : 0.48;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.31), material);
    plane.position.set(slot === 'primary' ? 0.08 : 0.12, slot === 'primary' ? 0.09 : 0.08, slot === 'primary' ? -0.67 : -0.72);
    plane.renderOrder = 1005;
    this.disposables.push(texture, material, plane.geometry);
    return plane;
  }

  private createAccessoryLight(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0b0d0e, roughness: 0.42, metalness: 0.28, depthTest: false, depthWrite: false, flatShading: true });
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xd6f7ff, transparent: true, opacity: 0.78, depthTest: false, depthWrite: false, toneMapped: false });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 16), bodyMat);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.018, 16), lensMat);
    body.rotation.x = Math.PI / 2;
    lens.rotation.x = Math.PI / 2;
    lens.position.z = -0.18;
    group.add(body, lens);
    this.disposables.push(body.geometry, lens.geometry, bodyMat, lensMat);
    return group;
  }

  private drawPolygon(context: CanvasRenderingContext2D, points: [number, number][], fill: string, stroke = '#05070b', lineWidth = 10): void {
    context.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    context.stroke();
  }

  private drawRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, fill: string, stroke = '#05070b', lineWidth = 8): void {
    context.fillStyle = fill;
    context.fillRect(x, y, width, height);
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    context.strokeRect(x, y, width, height);
  }

  private drawBarrel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, fill = '#151923'): void {
    this.drawRect(context, x, y, width, height, fill);
    this.drawRect(context, x + width - 22, y - 10, 40, height + 20, '#090b10');
  }

  private drawWeaponPattern(context: CanvasRenderingContext2D, palette: WeaponSkinPalette, x: number, y: number, width: number, height: number): void {
    const main = `#${palette.main.toString(16).padStart(6, '0')}`;
    const secondary = `#${palette.secondary.toString(16).padStart(6, '0')}`;
    const glow = `#${palette.glow.toString(16).padStart(6, '0')}`;

    this.drawPolygon(context, [
      [x, y + height * 0.25],
      [x + width * 0.32, y],
      [x + width * 0.56, y + height * 0.25],
      [x + width * 0.38, y + height],
      [x + width * 0.08, y + height * 0.82],
    ], main, '#05070b', 7);
    this.drawPolygon(context, [
      [x + width * 0.45, y + 6],
      [x + width, y + height * 0.08],
      [x + width * 0.86, y + height * 0.48],
      [x + width * 0.52, y + height * 0.42],
    ], secondary, '#05070b', 7);
    context.strokeStyle = glow;
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(x + width * 0.1, y + height * 0.58);
    context.lineTo(x + width * 0.82, y + height * 0.22);
    context.stroke();
  }

  private drawStylizedRifle(context: CanvasRenderingContext2D, weaponId: WeaponId, palette: WeaponSkinPalette): void {
    const main = `#${palette.main.toString(16).padStart(6, '0')}`;
    const secondary = `#${palette.secondary.toString(16).padStart(6, '0')}`;
    const glow = `#${palette.glow.toString(16).padStart(6, '0')}`;
    const isSniper = weaponId === 'awp';
    const isBullpup = weaponId === 'famas' || weaponId === 'galil';
    const baseY = 165;

    context.shadowColor = 'rgba(0,0,0,0.35)';
    context.shadowBlur = 16;
    context.shadowOffsetY = 10;

    this.drawPolygon(context, [
      [120, baseY + 8],
      [220, baseY - 34],
      [288, baseY - 12],
      [224, baseY + 38],
      [132, baseY + 48],
    ], secondary, '#05070b', 11);

    this.drawPolygon(context, [
      [250, baseY - 48],
      [540, baseY - 58],
      [632, baseY - 22],
      [600, baseY + 38],
      [294, baseY + 54],
      [232, baseY + 22],
    ], '#111821', '#05070b', 12);

    this.drawWeaponPattern(context, palette, 300, baseY - 46, 270, 88);
    this.drawRect(context, 405, baseY - 76, 210, 30, main, '#05070b', 8);
    this.drawRect(context, 468, baseY + 42, 92, 36, secondary, '#05070b', 8);

    if (isBullpup) {
      this.drawRect(context, 545, baseY - 34, 92, 96, '#101721', '#05070b', 10);
      this.drawPolygon(context, [[360, baseY + 35], [454, baseY + 52], [434, baseY + 130], [348, baseY + 118]], main, '#05070b', 9);
    } else {
      this.drawPolygon(context, [[444, baseY + 44], [520, baseY + 54], [506, baseY + 126], [432, baseY + 110]], main, '#05070b', 9);
    }

    this.drawPolygon(context, [[332, baseY + 34], [392, baseY + 48], [366, baseY + 130], [304, baseY + 112]], '#151923', '#05070b', 9);
    this.drawBarrel(context, 610, baseY - 36, isSniper ? 210 : 160, isSniper ? 22 : 28);
    this.drawRect(context, isSniper ? 782 : 744, baseY - 50, isSniper ? 54 : 42, isSniper ? 50 : 58, '#0b0e13', '#05070b', 9);

    if (isSniper) {
      this.drawRect(context, 344, baseY - 128, 260, 42, '#111821', '#05070b', 10);
      this.drawRect(context, 300, baseY - 118, 68, 64, '#111821', '#05070b', 10);
      this.drawRect(context, 586, baseY - 120, 70, 66, '#111821', '#05070b', 10);
      this.drawRect(context, 606, baseY - 104, 34, 34, glow, '#05070b', 6);
    } else {
      this.drawRect(context, 370, baseY - 98, 190, 24, '#111821', '#05070b', 8);
      this.drawRect(context, 585, baseY - 75, 34, 48, '#111821', '#05070b', 8);
    }

    context.strokeStyle = glow;
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(320, baseY - 12);
    context.lineTo(574, baseY - 28);
    context.stroke();

    context.shadowBlur = 0;
  }

  private drawStylizedPistol(context: CanvasRenderingContext2D, weaponId: WeaponId, palette: WeaponSkinPalette): void {
    const main = `#${palette.main.toString(16).padStart(6, '0')}`;
    const secondary = `#${palette.secondary.toString(16).padStart(6, '0')}`;
    const glow = `#${palette.glow.toString(16).padStart(6, '0')}`;
    const isHeavy = weaponId === 'deagle';
    const baseY = 150;

    context.shadowColor = 'rgba(0,0,0,0.35)';
    context.shadowBlur = 16;
    context.shadowOffsetY = 10;

    this.drawPolygon(context, [
      [168, baseY - 48],
      [530, baseY - 58],
      [612, baseY - 20],
      [574, baseY + 30],
      [198, baseY + 42],
      [138, baseY + 10],
    ], '#111821', '#05070b', 14);
    this.drawPolygon(context, [
      [210, baseY - 36],
      [470, baseY - 42],
      [534, baseY - 14],
      [494, baseY + 18],
      [240, baseY + 26],
    ], main, '#05070b', 8);
    this.drawRect(context, 554, baseY - 38, isHeavy ? 90 : 58, 58, '#090b10', '#05070b', 10);
    this.drawBarrel(context, isHeavy ? 630 : 596, baseY - 22, isHeavy ? 96 : 70, 24);
    this.drawPolygon(context, [[310, baseY + 34], [432, baseY + 50], [390, baseY + 188], [270, baseY + 168]], secondary, '#05070b', 12);
    this.drawPolygon(context, [[338, baseY + 64], [398, baseY + 72], [370, baseY + 152], [304, baseY + 142]], main, '#05070b', 7);
    this.drawPolygon(context, [[236, baseY + 34], [320, baseY + 42], [292, baseY + 92], [218, baseY + 82]], '#151923', '#05070b', 9);
    this.drawRect(context, 268, baseY - 82, 120, 22, '#101721', '#05070b', 8);

    context.strokeStyle = glow;
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(242, baseY - 14);
    context.lineTo(505, baseY - 28);
    context.stroke();

    context.shadowBlur = 0;
  }

  private createRifleViewmodel(weaponId: WeaponId): void {
    const isScoped = weaponId === 'awp';
    const metal = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.42, metalness: 0.34, depthTest: false, depthWrite: false, flatShading: true });
    const parkerized = new THREE.MeshStandardMaterial({ color: 0x273038, roughness: 0.52, metalness: 0.18, depthTest: false, depthWrite: false, flatShading: true });
    const blackPolymer = new THREE.MeshStandardMaterial({ color: 0x07090b, roughness: 0.58, metalness: 0.08, depthTest: false, depthWrite: false, flatShading: true });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4328, roughness: 0.6, metalness: 0.02, depthTest: false, depthWrite: false, flatShading: true });
    const wornMetal = new THREE.MeshStandardMaterial({ color: 0x7d8589, roughness: 0.34, metalness: 0.42, depthTest: false, depthWrite: false, flatShading: true });
    const glass = new THREE.MeshBasicMaterial({ color: 0x061015, depthTest: false, depthWrite: false });
    const furniture = weaponId === 'ak47' ? wood : blackPolymer;

    const upperReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, isScoped ? 1.16 : 0.82), metal);
    const lowerReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.17, isScoped ? 0.56 : 0.44), parkerized);
    const ejectionPort = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.2), wornMetal);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 10), wornMetal);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, isScoped ? 0.9 : 0.62), furniture);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(isScoped ? 0.018 : 0.024, isScoped ? 0.018 : 0.024, isScoped ? 1.76 : 1.08, 16), metal);
    const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, isScoped ? 1.0 : 0.72, 12), parkerized);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(isScoped ? 0.034 : 0.04, isScoped ? 0.028 : 0.032, isScoped ? 0.2 : 0.16, 16), metal);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.14), blackPolymer);
    const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 12, Math.PI), metal);
    const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.01, 6, 14, Math.PI), metal);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.15, isScoped ? 0.22 : 0.44, 0.2), parkerized);
    const magFloorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.22), wornMetal);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, isScoped ? 0.72 : 0.46), furniture);
    const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.23, 0.055), blackPolymer);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, isScoped ? 0.96 : 0.68), blackPolymer);
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.045), metal);
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.045), metal);
    const slingLoop = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.005, 6, 12), wornMetal);
    const accessoryLight = this.createAccessoryLight();
    const supportHand = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.32), new THREE.MeshStandardMaterial({ color: 0x2b241e, roughness: 0.7, depthTest: false, depthWrite: false, flatShading: true }));
    const rearHand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.26), new THREE.MeshStandardMaterial({ color: 0x2b241e, roughness: 0.7, depthTest: false, depthWrite: false, flatShading: true }));

    upperReceiver.position.set(0.07, 0.02, -0.72);
    lowerReceiver.position.set(0.07, -0.12, -0.56);
    ejectionPort.position.set(-0.105, 0.05, -0.78);
    bolt.position.set(-0.13, 0.1, -0.48);
    bolt.rotation.z = Math.PI / 2;
    handguard.position.set(0.07, 0.02, isScoped ? -1.55 : -1.22);
    barrel.position.set(0.07, 0.04, isScoped ? -2.48 : -1.92);
    barrel.rotation.x = Math.PI / 2;
    gasTube.position.set(0.07, 0.1, isScoped ? -1.66 : -1.34);
    gasTube.rotation.x = Math.PI / 2;
    muzzle.position.set(0.07, 0.04, isScoped ? -3.34 : -2.52);
    muzzle.rotation.x = Math.PI / 2;
    frontSight.position.set(0.07, 0.17, isScoped ? -2.66 : -2.02);
    rearSight.position.set(0.07, 0.16, -0.54);
    grip.position.set(0.065, -0.38, -0.42);
    grip.rotation.x = -0.32;
    trigger.position.set(0.07, -0.23, -0.37);
    trigger.rotation.set(Math.PI / 2, 0, 0);
    triggerGuard.position.set(0.07, -0.2, -0.36);
    triggerGuard.rotation.set(Math.PI / 2, 0, 0);
    mag.position.set(0.07, -0.4, isScoped ? -0.58 : -0.72);
    mag.rotation.x = 0.16;
    magFloorPlate.position.set(0.07, isScoped ? -0.53 : -0.67, isScoped ? -0.62 : -0.76);
    magFloorPlate.rotation.x = 0.16;
    stock.position.set(0.07, -0.02, isScoped ? 0.34 : 0.13);
    stockPad.position.set(0.07, -0.02, isScoped ? 0.75 : 0.4);
    rail.position.set(0.07, 0.145, isScoped ? -0.9 : -0.76);
    slingLoop.position.set(-0.13, -0.02, isScoped ? 0.1 : -0.02);
    slingLoop.rotation.y = Math.PI / 2;
    accessoryLight.position.set(-0.13, -0.08, isScoped ? -1.38 : -1.12);
    supportHand.position.set(-0.13, -0.17, isScoped ? -1.38 : -1.06);
    supportHand.rotation.set(0.18, 0.22, -0.08);
    rearHand.position.set(0.17, -0.39, -0.33);
    rearHand.rotation.set(-0.26, -0.08, 0.08);

    const parts: THREE.Object3D[] = [
      upperReceiver,
      lowerReceiver,
      ejectionPort,
      bolt,
      handguard,
      barrel,
      gasTube,
      muzzle,
      grip,
      trigger,
      triggerGuard,
      mag,
      magFloorPlate,
      stock,
      stockPad,
      rail,
      frontSight,
      rearSight,
      slingLoop,
      accessoryLight,
      supportHand,
      rearHand,
    ];
    const geometries: THREE.BufferGeometry[] = [
      upperReceiver.geometry,
      lowerReceiver.geometry,
      ejectionPort.geometry,
      bolt.geometry,
      handguard.geometry,
      barrel.geometry,
      gasTube.geometry,
      muzzle.geometry,
      grip.geometry,
      trigger.geometry,
      triggerGuard.geometry,
      mag.geometry,
      magFloorPlate.geometry,
      stock.geometry,
      stockPad.geometry,
      rail.geometry,
      frontSight.geometry,
      rearSight.geometry,
      slingLoop.geometry,
      supportHand.geometry,
      rearHand.geometry,
    ];
    if (isScoped) {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.78, 18), metal);
      const scopeFront = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 18), metal);
      const scopeGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.064, 18), glass);
      const scopeMountA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.08), parkerized);
      const scopeMountB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.08), parkerized);
      scope.position.set(0.07, 0.28, -0.78);
      scope.rotation.x = Math.PI / 2;
      scopeFront.position.set(0.07, 0.28, -1.18);
      scopeFront.rotation.x = Math.PI / 2;
      scopeGlass.position.set(0.07, 0.28, -1.215);
      scopeGlass.rotation.x = Math.PI / 2;
      scopeMountA.position.set(0.07, 0.19, -0.96);
      scopeMountB.position.set(0.07, 0.19, -0.58);
      parts.push(scope, scopeFront, scopeGlass, scopeMountA, scopeMountB);
      geometries.push(scope.geometry, scopeFront.geometry, scopeGlass.geometry, scopeMountA.geometry, scopeMountB.geometry);
    } else {
      for (let index = 0; index < 7; index += 1) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.028, 0.035), metal);
        tooth.position.set(0.07, 0.178, -1.02 + index * 0.075);
        parts.push(tooth);
        geometries.push(tooth.geometry);
      }
    }

    const markings = this.createRealisticMarkings(weaponId, 'primary');
    this.weaponModelRoot.position.set(isScoped ? 0.54 : 0.5, isScoped ? -0.5 : -0.53, isScoped ? -1.26 : -1.34);
    this.weaponModelRoot.rotation.set(-0.04, -0.1, 0.018);
    this.weaponModelRoot.add(...parts, markings);
    this.disposables.push(...geometries, metal, parkerized, blackPolymer, wood, wornMetal, glass, supportHand.material, rearHand.material);
  }

  private createPistolViewmodel(weaponId: WeaponId): void {
    const isHeavy = weaponId === 'deagle';
    const bluedMetal = new THREE.MeshStandardMaterial({ color: 0x1d2226, roughness: 0.4, metalness: 0.38, depthTest: false, depthWrite: false, flatShading: true });
    const brushedSteel = new THREE.MeshStandardMaterial({ color: isHeavy ? 0x8a8172 : 0x626d73, roughness: 0.34, metalness: 0.45, depthTest: false, depthWrite: false, flatShading: true });
    const polymer = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.68, metalness: 0.04, depthTest: false, depthWrite: false, flatShading: true });
    const stipple = new THREE.MeshStandardMaterial({ color: 0x2b3033, roughness: 0.78, metalness: 0.02, depthTest: false, depthWrite: false, flatShading: true });
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, isHeavy ? 0.76 : 0.58), brushedSteel);
    const ejectionPort = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.11), bluedMetal);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, isHeavy ? 0.62 : 0.48), bluedMetal);
    const dustCover = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, isHeavy ? 0.34 : 0.24), polymer);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.18), polymer);
    const gripPanelLeft = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.27, 0.13), stipple);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, isHeavy ? 0.32 : 0.22, 16), brushedSteel);
    const recoilSpring = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, isHeavy ? 0.2 : 0.15, 12), bluedMetal);
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.045), bluedMetal);
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.038, 0.05), bluedMetal);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.055, 16), bluedMetal);
    const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.005, 6, 12, Math.PI), bluedMetal);
    const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.009, 6, 14, Math.PI), bluedMetal);
    const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.19), brushedSteel);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.17, 0.28), new THREE.MeshStandardMaterial({ color: 0x2b241e, roughness: 0.72, depthTest: false, depthWrite: false, flatShading: true }));
    slide.position.set(0.08, 0.03, -0.72);
    ejectionPort.position.set(0.08, 0.105, -0.78);
    frame.position.set(0.08, -0.085, -0.66);
    dustCover.position.set(0.08, -0.045, isHeavy ? -1.02 : -0.9);
    grip.position.set(0.08, -0.39, -0.43);
    grip.rotation.x = -0.26;
    gripPanelLeft.position.set(-0.01, -0.4, -0.46);
    gripPanelLeft.rotation.x = -0.26;
    barrel.position.set(0.08, 0.045, isHeavy ? -1.32 : -1.12);
    barrel.rotation.x = Math.PI / 2;
    recoilSpring.position.set(0.08, -0.012, isHeavy ? -1.18 : -1.0);
    recoilSpring.rotation.x = Math.PI / 2;
    muzzle.position.set(0.08, 0.045, isHeavy ? -1.53 : -1.28);
    muzzle.rotation.x = Math.PI / 2;
    frontSight.position.set(0.08, 0.13, isHeavy ? -1.12 : -0.96);
    rearSight.position.set(0.08, 0.13, -0.43);
    trigger.position.set(0.08, -0.19, -0.45);
    trigger.rotation.set(Math.PI / 2, 0, 0);
    triggerGuard.position.set(0.08, -0.18, -0.48);
    triggerGuard.rotation.set(Math.PI / 2, 0, 0);
    magBase.position.set(0.08, -0.59, -0.44);
    magBase.rotation.x = -0.26;
    hand.position.set(0.19, -0.47, -0.36);
    hand.rotation.set(-0.25, -0.14, 0.08);
    const serrations: THREE.Mesh[] = [];
    for (let index = 0; index < 5; index += 1) {
      const serration = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.075, 0.01), bluedMetal);
      serration.position.set(-0.085, 0.06, -0.48 - index * 0.035);
      serration.rotation.z = -0.35;
      serrations.push(serration);
    }

    const parts = [
      slide,
      ejectionPort,
      frame,
      dustCover,
      grip,
      gripPanelLeft,
      barrel,
      recoilSpring,
      frontSight,
      rearSight,
      muzzle,
      trigger,
      triggerGuard,
      magBase,
      hand,
      ...serrations,
    ];
    const markings = this.createRealisticMarkings(weaponId, 'secondary');
    this.weaponModelRoot.position.set(0.42, -0.52, -1.28);
    this.weaponModelRoot.rotation.set(-0.045, -0.1, 0.018);
    this.weaponModelRoot.add(...parts, markings);
    this.disposables.push(
      slide.geometry,
      ejectionPort.geometry,
      frame.geometry,
      dustCover.geometry,
      grip.geometry,
      gripPanelLeft.geometry,
      barrel.geometry,
      recoilSpring.geometry,
      frontSight.geometry,
      rearSight.geometry,
      muzzle.geometry,
      trigger.geometry,
      triggerGuard.geometry,
      magBase.geometry,
      hand.geometry,
      ...serrations.map((item) => item.geometry),
      bluedMetal,
      brushedSteel,
      polymer,
      stipple,
      hand.material,
    );
  }

  private createKnifeViewmodel(): void {
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcfd8d5, roughness: 0.22, metalness: 0.75, depthTest: false, depthWrite: false });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x111817, roughness: 0.6, metalness: 0.15, depthTest: false, depthWrite: false });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.78), bladeMat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.08), gripMat);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.36), gripMat);
    blade.position.set(0.08, 0.02, -0.82);
    blade.rotation.y = -0.18;
    guard.position.set(0.08, -0.02, -0.42);
    grip.position.set(0.08, -0.06, -0.2);
    this.weaponModelRoot.position.set(0.46, -0.5, -1.08);
    this.weaponModelRoot.rotation.set(0.2, -0.48, -0.34);
    this.weaponModelRoot.add(blade, guard, grip);
    this.disposables.push(blade.geometry, guard.geometry, grip.geometry, bladeMat, gripMat);
  }

  private createChromaKeyTexture(image: HTMLImageElement): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return new THREE.CanvasTexture(canvas);
    }

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      const isWhiteBackground = red > 238 && green > 238 && blue > 238;

      if (isWhiteBackground) {
        pixels.data[index + 3] = 0;
      }
    }

    context.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    return texture;
  }

  private createMuzzleFlash(): void {
    const texture = this.createMuzzleFlashTexture();
    const geometry = new THREE.PlaneGeometry(0.18, 0.18);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.muzzleFlash = new THREE.Mesh(geometry, material);
    this.muzzleFlash.position.set(-0.07, 0.1, -1.88);
    this.muzzleFlash.renderOrder = 1001;
    this.muzzleFlash.visible = false;
    this.viewmodelRoot.add(this.muzzleFlash);
    this.disposables.push(geometry, material, texture);

    for (let index = 0; index < 5; index += 1) {
      const sparkGeometry = new THREE.PlaneGeometry(0.025, 0.12);
      const sparkMaterial = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xfff0a6 : 0xff8a24,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
      spark.position.set(-0.07, 0.1, -1.87);
      spark.rotation.z = (Math.PI * 2 * index) / 5;
      spark.visible = false;
      spark.renderOrder = 1002;
      this.viewmodelRoot.add(spark);
      this.muzzleSparks.push(spark);
      this.disposables.push(sparkGeometry, sparkMaterial);
    }
  }

  private createMuzzleFlashTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    if (context) {
      const gradient = context.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255,255,245,1)');
      gradient.addColorStop(0.25, 'rgba(255,211,93,0.95)');
      gradient.addColorStop(0.55, 'rgba(255,107,24,0.45)');
      gradient.addColorStop(1, 'rgba(255,107,24,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);

      context.strokeStyle = 'rgba(255,236,150,0.75)';
      context.lineWidth = 8;
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI * 2 * index) / 6;
        context.beginPath();
        context.moveTo(size / 2, size / 2);
        context.lineTo(size / 2 + Math.cos(angle) * 56, size / 2 + Math.sin(angle) * 56);
        context.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createKnifeSlash(): void {
    const texture = this.createKnifeSlashTexture();
    const geometry = new THREE.PlaneGeometry(1.28, 0.78);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.knifeSlash = new THREE.Mesh(geometry, material);
    this.knifeSlash.position.set(0.06, -0.02, -1.65);
    this.knifeSlash.rotation.z = -0.22;
    this.knifeSlash.renderOrder = 1006;
    this.knifeSlash.visible = false;
    this.viewmodelRoot.add(this.knifeSlash);
    this.disposables.push(texture, geometry, material);
  }

  private createKnifeSlashTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const context = canvas.getContext('2d');

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const gradient = context.createLinearGradient(80, 258, 430, 58);
      gradient.addColorStop(0, 'rgba(90, 220, 255, 0)');
      gradient.addColorStop(0.32, 'rgba(180, 245, 255, 0.72)');
      gradient.addColorStop(0.58, 'rgba(255, 255, 255, 0.98)');
      gradient.addColorStop(1, 'rgba(255, 216, 94, 0)');
      context.strokeStyle = gradient;
      context.lineWidth = 34;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(82, 248);
      context.quadraticCurveTo(236, 96, 434, 70);
      context.stroke();

      context.strokeStyle = 'rgba(255, 255, 255, 0.62)';
      context.lineWidth = 10;
      context.beginPath();
      context.moveTo(114, 228);
      context.quadraticCurveTo(250, 122, 404, 90);
      context.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createSecondPersonPlayer(): void {
    if (this.bridge.isNetworkMultiplayer) {
      return;
    }

    const teammateCount = Math.max(0, this.bridge.teamSize - 1);
    for (let index = 0; index < teammateCount; index += 1) {
      const ally = this.createAllyModel();
      const allyStart = this.bridge.map.allyStarts[index + 1] ?? this.bridge.map.allyStarts[index] ?? { x: -4, y: 0, z: 24 };
      ally.position.set(allyStart.x, allyStart.y, allyStart.z);
      ally.rotation.y = Math.PI + (index - teammateCount / 2) * 0.08;
      this.remotePlayerRoot.add(ally);
    }

    this.scene.add(this.remotePlayerRoot);
  }

  private createAllyModel(): THREE.Group {
    const root = new THREE.Group();
    const uniformMaterial = new THREE.MeshStandardMaterial({ color: 0x344b55, roughness: 0.72 });
    const vestMaterial = new THREE.MeshStandardMaterial({ color: 0x1c2425, roughness: 0.8 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xb98a66, roughness: 0.65 });
    const rifleMaterial = new THREE.MeshStandardMaterial({ color: 0x151819, roughness: 0.42, metalness: 0.35 });
    const barrelMaterial = new THREE.MeshStandardMaterial({ color: 0x99978d, roughness: 0.3, metalness: 0.5 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 8, 12), uniformMaterial);
    body.position.y = 1.05;

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.75, 0.28), vestMaterial);
    vest.position.set(0, 1.12, -0.18);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 12), skinMaterial);
    head.position.y = 1.82;

    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.72, 6, 8), uniformMaterial);
    leftArm.position.set(-0.42, 1.25, -0.38);
    leftArm.rotation.x = Math.PI / 2.8;
    leftArm.rotation.z = 0.18;

    const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.78, 6, 8), uniformMaterial);
    rightArm.position.set(0.42, 1.25, -0.38);
    rightArm.rotation.x = Math.PI / 2.75;
    rightArm.rotation.z = -0.18;

    const rifle = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.78), rifleMaterial);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.34), rifleMaterial);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 12), barrelMaterial);
    receiver.position.z = -0.48;
    stock.position.z = -0.08;
    barrel.position.z = -1.1;
    barrel.rotation.x = Math.PI / 2;
    rifle.add(receiver, stock, barrel);
    rifle.position.set(0, 1.22, -0.72);

    root.add(body, vest, head, leftArm, rightArm, rifle);

    this.disposables.push(
      body.geometry,
      vest.geometry,
      head.geometry,
      leftArm.geometry,
      rightArm.geometry,
      receiver.geometry,
      stock.geometry,
      barrel.geometry,
      uniformMaterial,
      vestMaterial,
      skinMaterial,
      rifleMaterial,
      barrelMaterial,
    );

    return root;
  }

  private createEnemies(): void {
    this.bridge.enemies.forEach((enemy, index) => {
      const model = this.createEnemyModel(index, 'BOT', 'enemy');
      model.root.position.set(enemy.position.x, 0, enemy.position.z);
      this.scene.add(model.root);
      this.enemyModels.set(enemy.id, model);
    });
  }

  private syncRemotePlayers(): void {
    const activeIds = new Set(this.bridge.remotePlayers.map((player) => player.id));
    this.remotePlayerModels.forEach((model, playerId) => {
      if (!activeIds.has(playerId)) {
        this.scene.remove(model.root);
        this.remotePlayerModels.delete(playerId);
      }
    });

    this.bridge.remotePlayers.forEach((player, index) => {
      let view = this.remotePlayerModels.get(player.id);
      if (!view) {
        view = this.createEnemyModel(index, player.name, player.team);
        this.scene.add(view.root);
        this.remotePlayerModels.set(player.id, view);
      }

      view.root.visible = player.alive;
      view.label.visible = true;
      this.applyThirdPersonPose(view, player.position);
      view.root.rotation.y = player.yaw;
      view.rifle.rotation.x = -0.08 + player.pitch * 0.25;
      view.bodyMaterial.color.setHex(player.team === 'friendly' ? 0x2c5a76 : 0x7b2532);
      view.armorMaterial.emissive.setHex(player.team === this.bridge.localTeam ? 0x12364c : 0x3a0c12);
    });
  }

  private syncEnemies(): void {
    this.bridge.enemies.forEach((enemy) => {
      const view = this.enemyModels.get(enemy.id);
      if (!view) {
        return;
      }

      view.root.visible = enemy.alive || enemy.aiState === 'death';
      view.label.visible = enemy.alive && enemy.team === 'enemy';
      this.applyThirdPersonPose(view, enemy.position);
      const lookTarget = this.bridge.localPlayer.position;
      view.root.rotation.y = Math.atan2(lookTarget.x - enemy.position.x, lookTarget.z - enemy.position.z);
      view.root.rotation.z = enemy.aiState === 'death' ? Math.PI / 2 : 0;
      view.rifle.rotation.x = enemy.aiState === 'shoot' ? -0.22 : -0.08;
      const isShooting = enemy.alive && enemy.aiState === 'shoot';
      view.muzzleFlash.visible = isShooting;
      view.tracer.visible = isShooting;
      if (isShooting) {
        const pulse = 0.85 + Math.sin(performance.now() * 0.06) * 0.25;
        view.muzzleFlash.scale.set(0.38 * pulse, 0.38 * pulse, 1);
        view.muzzleFlash.material.rotation += 0.35;
        view.tracer.material.opacity = 0.55 + Math.sin(performance.now() * 0.08) * 0.25;
      }
      view.bodyMaterial.color.setHex(enemy.health > 50 ? 0x7b2532 : 0x4f2a1d);
      view.armorMaterial.emissive.setHex(enemy.health > 50 ? 0x3a0c12 : 0x5a2408);
      view.visorMaterial.emissiveIntensity = enemy.aiState === 'shoot' ? 1.8 : 0.9;
    });
  }

  private applyThirdPersonPose(view: EnemyModelView, position: Vec3): void {
    const eyeHeight = position.y;
    const jumpHeight = Math.max(0, eyeHeight - 1.82);
    const crouchAmount = Math.max(0, Math.min(1, (1.72 - eyeHeight) / 0.58));
    const bodyScaleY = 1 - crouchAmount * 0.28;

    view.root.position.set(position.x, jumpHeight, position.z);
    view.bodyRoot.scale.y += (bodyScaleY - view.bodyRoot.scale.y) * 0.45;
    view.bodyRoot.position.y = crouchAmount * -0.08;
    view.label.position.y = 2.5 * view.bodyRoot.scale.y + jumpHeight * 0.2;
  }

  private syncBulletTrails(): void {
    const nowSeconds = performance.now() / 1000;
    const activeTrails = this.bridge.bulletTrails.filter((trail) => trail.expiresAtSeconds > nowSeconds);
    const activeIds = new Set(activeTrails.map((trail) => trail.id));

    this.bulletTrailViews.forEach((view, trailId) => {
      if (!activeIds.has(trailId)) {
        this.scene.remove(view.mesh);
        view.mesh.geometry.dispose();
        view.mesh.material.dispose();
        this.bulletTrailViews.delete(trailId);
      }
    });

    activeTrails.forEach((trail) => {
      let view = this.bulletTrailViews.get(trail.id);
      if (!view) {
        view = this.createBulletTrailView(trail);
        this.bulletTrailViews.set(trail.id, view);
        this.scene.add(view.mesh);
      }

      const life = Math.max(0, (trail.expiresAtSeconds - nowSeconds) / (trail.expiresAtSeconds - trail.createdAtSeconds));
      view.mesh.material.opacity = 0.18 + life * 0.72;
      view.mesh.scale.setScalar(0.72 + life * 0.28);
    });
  }

  private createBulletTrailView(trail: BulletTrailSnapshot): BulletTrailView {
    const length = Math.max(0.01, this.distance(trail.from, trail.to));
    const material = new THREE.MeshBasicMaterial({
      color: trail.team === 'friendly' ? 0x9fe8ff : 0xffd27a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.008, length, 8), material);
    this.positionBulletTrail(mesh, trail.from, trail.to);
    return { mesh };
  }

  private positionBulletTrail(mesh: THREE.Mesh, from: Vec3, to: Vec3): void {
    const start = new THREE.Vector3(from.x, from.y, from.z);
    const end = new THREE.Vector3(to.x, to.y, to.z);
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const direction = end.clone().sub(start).normalize();
    mesh.position.copy(midpoint);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  }

  private distance(from: Vec3, to: Vec3): number {
    return Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  }

  private createEnemyModel(index: number, labelText = 'ENEMY', team: 'friendly' | 'enemy' = 'enemy'): EnemyModelView {
    const root = new THREE.Group();
    const bodyRoot = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: team === 'friendly' ? 0x2c5a76 : index % 2 === 0 ? 0x7b2532 : 0x81331f, roughness: 0.82 });
    const armorMaterial = new THREE.MeshStandardMaterial({
      color: 0x29221e,
      roughness: 0.76,
      metalness: 0.04,
      emissive: 0x3a0c12,
      emissiveIntensity: 0.28,
    });
    const visorMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.36,
      metalness: 0.08,
      emissive: 0xff4f5e,
      emissiveIntensity: 0.9,
    });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xc78655, roughness: 0.82 });
    const bootMaterial = new THREE.MeshStandardMaterial({ color: 0x171312, roughness: 0.8 });
    const rifleMaterial = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.52, metalness: 0.18 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.86, 0.42), bodyMaterial);
    torso.position.y = 1.12;
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.56, 0.48), armorMaterial);
    vest.position.set(0, 1.1, -0.03);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.24), skinMaterial);
    neck.position.y = 1.62;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skinMaterial);
    head.position.y = 1.9;
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.2, 0.56), armorMaterial);
    helmet.position.y = 2.14;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.035), visorMaterial);
    visor.position.set(0, 1.92, -0.255);

    const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), bodyMaterial);
    leftUpperArm.position.set(-0.54, 1.24, -0.14);
    leftUpperArm.rotation.x = Math.PI / 2.7;
    leftUpperArm.rotation.z = -0.12;
    const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), bodyMaterial);
    rightUpperArm.position.set(0.54, 1.24, -0.14);
    rightUpperArm.rotation.x = Math.PI / 2.7;
    rightUpperArm.rotation.z = 0.12;
    const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.46, 0.2), skinMaterial);
    leftForearm.position.set(-0.32, 1.06, -0.52);
    leftForearm.rotation.x = Math.PI / 2.25;
    leftForearm.rotation.z = 0.08;
    const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.46, 0.2), skinMaterial);
    rightForearm.position.set(0.32, 1.06, -0.52);
    rightForearm.rotation.x = Math.PI / 2.25;
    rightForearm.rotation.z = -0.08;
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.72, 0.28), bodyMaterial);
    leftLeg.position.set(-0.22, 0.45, 0);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.72, 0.28), bodyMaterial);
    rightLeg.position.set(0.22, 0.45, 0);
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.42), bootMaterial);
    leftBoot.position.set(-0.22, 0.09, -0.06);
    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.42), bootMaterial);
    rightBoot.position.set(0.22, 0.09, -0.06);

    const rifle = new THREE.Group();
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.74), rifleMaterial);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.18), visorMaterial);
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.18), rifleMaterial);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.72, 8), rifleMaterial);
    receiver.position.z = -0.35;
    sight.position.set(0, 0.13, -0.35);
    magazine.position.set(0, -0.24, -0.22);
    magazine.rotation.x = 0.16;
    barrel.position.z = -0.92;
    barrel.rotation.x = Math.PI / 2;
    rifle.add(receiver, sight, magazine, barrel);
    rifle.position.set(0, 1.18, -0.58);
    const muzzleFlash = this.createEnemyMuzzleFlashSprite();
    muzzleFlash.position.set(0, 0, -1.3);
    muzzleFlash.visible = false;
    rifle.add(muzzleFlash);

    const tracerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe27a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 4.8, 8), tracerMaterial);
    tracer.position.set(0, 0, -3.5);
    tracer.rotation.x = Math.PI / 2;
    tracer.visible = false;
    rifle.add(tracer);

    bodyRoot.add(
      torso,
      vest,
      neck,
      head,
      helmet,
      visor,
      leftUpperArm,
      rightUpperArm,
      leftForearm,
      rightForearm,
      leftLeg,
      rightLeg,
      leftBoot,
      rightBoot,
      rifle,
    );
    root.add(bodyRoot);
    const label = this.createEnemyLabelSprite(labelText, team);
    label.position.set(0, 2.5, 0);
    root.add(label);
    this.disposables.push(
      torso.geometry,
      vest.geometry,
      neck.geometry,
      head.geometry,
      helmet.geometry,
      visor.geometry,
      leftUpperArm.geometry,
      rightUpperArm.geometry,
      leftForearm.geometry,
      rightForearm.geometry,
      leftLeg.geometry,
      rightLeg.geometry,
      leftBoot.geometry,
      rightBoot.geometry,
      receiver.geometry,
      sight.geometry,
      magazine.geometry,
      barrel.geometry,
      tracer.geometry,
      bodyMaterial,
      armorMaterial,
      visorMaterial,
      skinMaterial,
      bootMaterial,
      rifleMaterial,
      tracerMaterial,
    );

    return { root, bodyRoot, bodyMaterial, armorMaterial, visorMaterial, rifle, muzzleFlash, tracer, label };
  }

  private createEnemyMuzzleFlashSprite(): THREE.Sprite {
    const texture = this.createMuzzleFlashTexture();
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.38, 0.38, 1);
    sprite.renderOrder = 15;
    this.disposables.push(texture, material);
    return sprite;
  }

  private createEnemyLabelSprite(label = 'ENEMY', team: 'friendly' | 'enemy' = 'enemy'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d');

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = team === 'friendly' ? 'rgba(18, 65, 92, 0.78)' : 'rgba(98, 14, 22, 0.78)';
      context.fillRect(22, 12, 212, 40);
      context.strokeStyle = team === 'friendly' ? 'rgba(91, 190, 255, 0.95)' : 'rgba(255, 91, 108, 0.95)';
      context.lineWidth = 3;
      context.strokeRect(22, 12, 212, 40);
      context.fillStyle = '#fff3f4';
      context.font = '900 24px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label.slice(0, 16), 128, 33);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.05, 0.26, 1);
    sprite.renderOrder = 20;
    this.disposables.push(texture, material);
    return sprite;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load sprite sheet: ${src}`));
      image.src = src;
    });
  }

  private cloneSpriteAnimations(
    animations: Record<EnemyAiState, SpriteAnimation>,
  ): Record<EnemyAiState, SpriteAnimation> {
    const cloneAnimation = (animation: SpriteAnimation): SpriteAnimation => {
      const texture = animation.texture.clone();
      texture.needsUpdate = true;
      texture.repeat.set(1 / animation.frameCount, 1);
      texture.offset.set(0, 0);
      this.disposables.push(texture);

      return {
        texture,
        frameCount: animation.frameCount,
      };
    };

    return {
      idle: cloneAnimation(animations.idle),
      run: cloneAnimation(animations.run),
      shoot: cloneAnimation(animations.shoot),
      crouch: cloneAnimation(animations.crouch),
      death: cloneAnimation(animations.death),
    };
  }

  private createSpriteAnimation(image: HTMLImageElement, frames: SpriteFrame[]): SpriteAnimation {
    const keyedFrames = frames.map((frame) => {
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = frame.width;
      sourceCanvas.height = frame.height;
      const context = sourceCanvas.getContext('2d');

      if (context) {
        context.drawImage(
          image,
          frame.x,
          frame.y,
          frame.width,
          frame.height,
          0,
          0,
          frame.width,
          frame.height,
        );
        const pixels = context.getImageData(0, 0, frame.width, frame.height);
        let minX = frame.width;
        let minY = frame.height;
        let maxX = 0;
        let maxY = 0;
        let hasVisiblePixels = false;

        for (let index = 0; index < pixels.data.length; index += 4) {
          const red = pixels.data[index];
          const green = pixels.data[index + 1];
          const blue = pixels.data[index + 2];
          const max = Math.max(red, green, blue);
          const min = Math.min(red, green, blue);
          const isCheckerBackground = max - min < 12 && max > 150;
          const isGreenKey = green > 210 && red < 70 && blue < 90;
          const isMagentaKey = red > 210 && blue > 210 && green < 90;
          const isWhiteKey = red > 238 && green > 238 && blue > 238;

          if (isCheckerBackground || isGreenKey || isMagentaKey || isWhiteKey) {
            pixels.data[index + 3] = 0;
          } else {
            hasVisiblePixels = true;
            const pixelIndex = index / 4;
            const x = pixelIndex % frame.width;
            const y = Math.floor(pixelIndex / frame.width);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }

        context.putImageData(pixels, 0, 0);

        const trimPadding = 2;
        const trimX = hasVisiblePixels ? Math.max(0, minX - trimPadding) : 0;
        const trimY = hasVisiblePixels ? Math.max(0, minY - trimPadding) : 0;
        const trimWidth = hasVisiblePixels
          ? Math.min(frame.width - trimX, maxX - minX + 1 + trimPadding * 2)
          : frame.width;
        const trimHeight = hasVisiblePixels
          ? Math.min(frame.height - trimY, maxY - minY + 1 + trimPadding * 2)
          : frame.height;

        return {
          sourceCanvas,
          trimX,
          trimY,
          trimWidth: Math.max(1, trimWidth),
          trimHeight: Math.max(1, trimHeight),
        };
      }

      return {
        sourceCanvas,
        trimX: 0,
        trimY: 0,
        trimWidth: frame.width,
        trimHeight: frame.height,
      };
    });

    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = ENEMY_FRAME_WIDTH * keyedFrames.length;
    atlasCanvas.height = ENEMY_FRAME_HEIGHT;
    const context = atlasCanvas.getContext('2d');

    keyedFrames.forEach((frame, frameIndex) => {
      const drawScale = Math.min(
        1,
        (ENEMY_FRAME_WIDTH - 8) / frame.trimWidth,
        (ENEMY_FRAME_HEIGHT - 8) / frame.trimHeight,
      );
      const drawWidth = Math.round(frame.trimWidth * drawScale);
      const drawHeight = Math.round(frame.trimHeight * drawScale);
      const frameX = frameIndex * ENEMY_FRAME_WIDTH;
      const drawX = frameX + Math.round((ENEMY_FRAME_WIDTH - drawWidth) / 2);
      const drawY = ENEMY_FRAME_HEIGHT - drawHeight;
      context?.drawImage(
        frame.sourceCanvas,
        frame.trimX,
        frame.trimY,
        frame.trimWidth,
        frame.trimHeight,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      );
    });

    const texture = new THREE.CanvasTexture(atlasCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1 / keyedFrames.length, 1);
    texture.offset.set(0, 0);
    this.disposables.push(texture);

    return {
      texture,
      frameCount: keyedFrames.length,
    };
  }

  private updateViewmodelRecoil(): void {
    const impulse = this.bridge.localPlayer.recoilImpulse;
    if (impulse > 0) {
      this.recoilKick += impulse * 0.18;
      this.recoilReturn += impulse * 0.08;
      this.flashLife = Math.max(this.flashLife, 1);
      this.bridge.consumeRecoilImpulse(impulse);
    }

    const slashImpulse = this.bridge.localPlayer.knifeSlashImpulse;
    if (slashImpulse > 0) {
      this.knifeSlashLife = Math.max(this.knifeSlashLife, slashImpulse);
      this.recoilReturn -= slashImpulse * 0.16;
      this.bridge.consumeKnifeSlashImpulse(slashImpulse);
    }

    this.recoilKick *= 0.76;
    this.recoilReturn *= 0.82;

    this.viewmodelRoot.position.z = this.recoilKick;
    this.viewmodelRoot.position.y = -this.recoilKick * 0.45;
    this.viewmodelRoot.rotation.x = -this.recoilKick * 0.7;
    this.viewmodelRoot.rotation.z = -this.recoilReturn * 0.35;
    this.updateMuzzleFlash();
    this.updateKnifeSlash();
  }

  private updateKnifeSlash(): void {
    if (!this.knifeSlash) {
      return;
    }

    this.knifeSlashLife *= 0.58;
    const life = this.knifeSlashLife;
    this.knifeSlash.visible = life > 0.025;
    this.knifeSlash.material.opacity = Math.min(1, life);
    this.knifeSlash.scale.set(0.7 + life * 0.8, 0.7 + life * 0.42, 1);
    this.knifeSlash.rotation.z = -0.62 + life * 0.9;
    this.knifeSlash.position.x = 0.2 - life * 0.24;
    this.knifeSlash.position.y = -0.08 + life * 0.1;
  }

  private updateMuzzleFlash(): void {
    if (!this.muzzleFlash) {
      return;
    }

    this.flashLife *= 0.48;
    this.muzzleFlash.visible = this.flashLife > 0.03;
    this.muzzleFlash.material.opacity = Math.min(1, this.flashLife);
    const flashScale = 0.65 + this.flashLife * 0.55;
    this.muzzleFlash.scale.set(flashScale, flashScale, 1);
    this.muzzleFlash.rotation.z += 0.72;

    this.muzzleSparks.forEach((spark, index) => {
      const sparkLife = Math.max(0, this.flashLife - index * 0.035);
      spark.visible = sparkLife > 0.03;
      spark.material.opacity = Math.min(1, sparkLife);
      const spread = 0.08 + index * 0.012;
      spark.position.x = -0.07 + Math.cos(spark.rotation.z) * spread * sparkLife;
      spark.position.y = 0.1 + Math.sin(spark.rotation.z) * spread * sparkLife;
      spark.scale.y = 0.65 + sparkLife * 1.2;
    });
  }

  private animateSecondPerson(): void {
    const time = performance.now() / 1000;
    this.remotePlayerRoot.rotation.y = Math.PI + Math.sin(time * 0.8) * 0.08;
    this.remotePlayerRoot.position.y = Math.sin(time * 2.4) * 0.018;
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.viewmodelCamera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.viewmodelCamera.updateProjectionMatrix();
  };
}
