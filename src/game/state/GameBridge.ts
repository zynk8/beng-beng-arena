import type { Store } from 'pinia';
import type { TacticalMapDefinition } from '../domain/deathmatch1Map';
import type { BulletTrailSnapshot, BuyAction, CombatantTeam, EnemyAiState, EnemySnapshot, GamePhase, KeyBindings, PlayerSnapshot, RemotePlayerSnapshot, Vec3, WeaponSlot } from '../types/game';
import type { useGameState } from './useGameState';

type GameStore = ReturnType<typeof useGameState> & Store;

export class GameBridge {
  constructor(private readonly store: GameStore) {}

  get localPlayer(): PlayerSnapshot {
    return this.store.localPlayer;
  }

  get map(): TacticalMapDefinition {
    return this.store.selectedMap;
  }

  get phase(): GamePhase {
    return this.store.phase;
  }

  get enemies(): EnemySnapshot[] {
    return this.store.enemies;
  }

  get remotePlayers(): RemotePlayerSnapshot[] {
    return this.store.remotePlayers;
  }

  get bulletTrails(): BulletTrailSnapshot[] {
    return this.store.bulletTrails;
  }

  get keyBindings(): KeyBindings {
    return this.store.keyBindings;
  }

  get isGameOver(): boolean {
    return this.store.isGameOver;
  }

  get isBuyMenuOpen(): boolean {
    return this.store.isBuyMenuOpen;
  }

  get teamSize(): number {
    return this.store.lobby.teamSize;
  }

  get isNetworkMultiplayer(): boolean {
    return this.store.lobby.mode === 'multiplayer' && this.store.lobby.lobbyCode !== 'LOCAL';
  }

  get localTeam(): CombatantTeam {
    return this.store.lobby.players.find((player) => player.id === this.store.lobby.localPlayerId)?.team ?? 'friendly';
  }

  setHealth(health: number): void {
    this.store.setHealth(health);
  }

  setAmmo(ammoInMagazine: number, reserveAmmo?: number): void {
    this.store.setAmmo(ammoInMagazine, reserveAmmo);
  }

  setPlayerPose(position: Vec3, yaw: number, pitch: number): void {
    this.store.setPlayerPose(position, yaw, pitch);
  }

  setPlayerPosture(isCrouching: boolean, isJumping: boolean): void {
    this.store.setPlayerPosture(isCrouching, isJumping);
  }

  setPointerLocked(isPointerLocked: boolean): void {
    this.store.setPointerLocked(isPointerLocked);
  }

  setZooming(isZooming: boolean): void {
    this.store.setZooming(isZooming);
  }

  addRecoilImpulse(amount: number): void {
    this.store.addRecoilImpulse(amount);
  }

  addKnifeSlashImpulse(amount?: number): void {
    this.store.addKnifeSlashImpulse(amount);
  }

  consumeRecoilImpulse(amount: number): void {
    this.store.consumeRecoilImpulse(amount);
  }

  consumeKnifeSlashImpulse(amount: number): void {
    this.store.consumeKnifeSlashImpulse(amount);
  }

  recordBulletTrail(from: Vec3, to: Vec3, team: CombatantTeam): void {
    this.store.recordBulletTrail(from, to, team);
  }

  buy(action: BuyAction): void {
    this.store.buy(action);
  }

  switchWeapon(slot: WeaponSlot): void {
    this.store.switchWeapon(slot);
  }

  quickSwitchWeapon(): void {
    this.store.quickSwitchWeapon();
  }

  addAmmo(slot: Exclude<WeaponSlot, 'knife'>): void {
    this.store.addAmmo(slot);
  }

  startReload(): void {
    this.store.startReload();
  }

  setReloadProgress(progress: number): void {
    this.store.setReloadProgress(progress);
  }

  finishReload(): void {
    this.store.finishReload();
  }

  damageEnemy(enemyId: string, damage: number): void {
    this.store.damageEnemy(enemyId, damage);
  }

  damageRemotePlayer(playerId: string, damage: number): void {
    this.store.reportRemoteHit(playerId, damage);
  }

  updateEnemyRespawns(nowSeconds: number): void {
    this.store.updateEnemyRespawns(nowSeconds);
  }

  moveEnemy(enemyId: string, position: Vec3): void {
    this.store.moveEnemy(enemyId, position);
  }

  setEnemyNextShot(enemyId: string, nextShotAtSeconds: number): void {
    this.store.setEnemyNextShot(enemyId, nextShotAtSeconds);
  }

  setEnemyAiState(enemyId: string, aiState: EnemyAiState, stateUntilSeconds = 0): void {
    this.store.setEnemyAiState(enemyId, aiState, stateUntilSeconds);
  }

  damagePlayer(damage: number): void {
    this.store.damagePlayer(damage);
  }
}
