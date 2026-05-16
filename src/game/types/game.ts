export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerSnapshot {
  id: string;
  health: number;
  armor: number;
  ammoInMagazine: number;
  reserveAmmo: number;
  grenades: number;
  weaponSlot: WeaponSlot;
  previousWeaponSlot: WeaponSlot;
  inventory: WeaponInventory;
  isReloading: boolean;
  reloadProgress: number;
  isZooming: boolean;
  recoilImpulse: number;
  knifeSlashImpulse: number;
  position: Vec3;
  yaw: number;
  pitch: number;
  isCrouching: boolean;
  isJumping: boolean;
}

export interface RemotePlayerSnapshot {
  id: string;
  name: string;
  team: CombatantTeam;
  health: number;
  position: Vec3;
  yaw: number;
  pitch: number;
  alive: boolean;
  isHost: boolean;
  isCrouching: boolean;
  isJumping: boolean;
}

export type WeaponSlot = 'primary' | 'secondary' | 'knife';
export type WeaponCategory = 'pistol' | 'rifle' | 'grenade' | 'knife';
export type EnemyAiState = 'idle' | 'run' | 'shoot' | 'crouch' | 'death';
export type CombatantTeam = 'friendly' | 'enemy';
export type GamePhase = 'preload' | 'lobby' | 'loading' | 'playing';
export type LobbyMode = 'solo' | 'multiplayer';
export type TacticalMapId = 'deathmatch1' | 'dockyard' | 'rooftop';
export type WeaponId =
  | 'knife'
  | 'glock'
  | 'usp'
  | 'deagle'
  | 'm4a1'
  | 'ak47'
  | 'famas'
  | 'galil'
  | 'awp'
  | 'flashbang'
  | 'smoke'
  | 'frag';
export type BuyAction = 'buyPrimary' | 'buySecondary' | 'buyGrenade' | 'buyKevlar';

export interface WeaponDefinition {
  slot: WeaponSlot;
  id: WeaponId;
  category: WeaponCategory;
  name: string;
  imagePath?: string;
  firstPersonImagePath?: string;
  magazineSize: number;
  reserveAmmo: number;
  damage: number;
  fireCooldownSeconds: number;
  reloadSeconds: number;
}

export interface WeaponInventoryItem {
  owned: boolean;
  weaponId: WeaponId;
  ammoInMagazine: number;
  reserveAmmo: number;
}

export type WeaponInventory = Record<WeaponSlot, WeaponInventoryItem>;

export interface EnemySnapshot {
  id: string;
  team: CombatantTeam;
  health: number;
  position: Vec3;
  alive: boolean;
  aiState: EnemyAiState;
  nextShotAtSeconds: number;
  stateUntilSeconds: number;
  strafeDirection: number;
  respawnAtSeconds: number;
}

export interface BulletTrailSnapshot {
  id: string;
  from: Vec3;
  to: Vec3;
  team: CombatantTeam;
  createdAtSeconds: number;
  expiresAtSeconds: number;
}

export interface KeyBindings {
  jump: string;
  duck: string;
  zoomCrosshair: string;
  reload: string;
  buyPrimary: string;
  buySecondary: string;
  buyGrenade: string;
  buyKevlar: string;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  team: CombatantTeam;
  isHost: boolean;
  isLocal: boolean;
  ready: boolean;
}

export interface MultiplayerLobbyState {
  mode: LobbyMode | null;
  lobbyCode: string;
  isHost: boolean;
  localPlayerId: string;
  teamSize: number;
  mapId: TacticalMapId;
  players: LobbyPlayer[];
}

export interface InputSnapshot {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  zoomCrosshair: boolean;
  fire: boolean;
  reload: boolean;
  buyPrimary: boolean;
  buySecondary: boolean;
  buyGrenade: boolean;
  buyKevlar: boolean;
  switchPrimary: boolean;
  switchSecondary: boolean;
  switchKnife: boolean;
  quickSwitch: boolean;
  addPrimaryAmmo: boolean;
  addSecondaryAmmo: boolean;
  mouseDeltaX: number;
  mouseDeltaY: number;
}

export interface TacticalWorldState {
  phase: GamePhase;
  lobby: MultiplayerLobbyState;
  selectedMapId: TacticalMapId;
  localPlayer: PlayerSnapshot;
  remotePlayers: RemotePlayerSnapshot[];
  enemies: EnemySnapshot[];
  bulletTrails: BulletTrailSnapshot[];
  winnerName: string;
  winnerTeam: CombatantTeam | null;
  score: number;
  kills: number;
  keyBindings: KeyBindings;
  isBuyMenuOpen: boolean;
  isInBuyZone: boolean;
  isGameOver: boolean;
  roundTimeSeconds: number;
  isPointerLocked: boolean;
}

export interface Disposable {
  dispose(): void;
}
