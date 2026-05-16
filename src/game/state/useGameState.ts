import { defineStore } from 'pinia';
import { defaultMapId, getTacticalMap } from '../domain/deathmatch1Map';
import { defaultWeaponForSlot, getWeapon } from '../domain/weapons';
import { lobbyClient, type NetworkMatchState } from '../network/lobbyClient';
import type {
  BuyAction,
  BulletTrailSnapshot,
  EnemySnapshot,
  KeyBindings,
  LobbyPlayer,
  PlayerSnapshot,
  TacticalWorldState,
  TacticalMapId,
  Vec3,
  WeaponId,
  WeaponInventory,
  WeaponSlot,
} from '../types/game';

const maxTeamSize = 5;

const randomSpawn = (mapId: TacticalMapId): Vec3 => {
  const map = getTacticalMap(mapId);
  const spawn = map.enemyStarts[Math.floor(Math.random() * map.enemyStarts.length)];
  return { ...spawn };
};

const spawnForEnemyIndex = (index: number, mapId: TacticalMapId): Vec3 => {
  const map = getTacticalMap(mapId);
  const spawn = map.enemyStarts[index % map.enemyStarts.length];
  return { ...spawn };
};

const isInsideZone = (position: Vec3, center: Vec3, size: Vec3): boolean => (
  Math.abs(position.x - center.x) <= size.x / 2 &&
  Math.abs(position.z - center.z) <= size.z / 2
);

const defaultKeyBindings = (): KeyBindings => ({
  jump: 'Space',
  duck: 'ControlLeft',
  zoomCrosshair: 'ShiftLeft',
  reload: 'KeyR',
  buyPrimary: 'F5',
  buySecondary: 'F6',
  buyGrenade: 'F7',
  buyKevlar: 'F8',
});

const inventoryDefaults = (): WeaponInventory => {
  const knife = getWeapon('knife');
  const secondary = getWeapon(defaultWeaponForSlot.secondary);

  return {
    primary: {
      owned: false,
      weaponId: defaultWeaponForSlot.primary,
      ammoInMagazine: 0,
      reserveAmmo: 0,
    },
    secondary: {
      owned: true,
      weaponId: secondary.id,
      ammoInMagazine: secondary.magazineSize,
      reserveAmmo: secondary.reserveAmmo,
    },
    knife: {
      owned: true,
      weaponId: knife.id,
      ammoInMagazine: 0,
      reserveAmmo: 0,
    },
  };
};

const localPlayerDefaults = (mapId: TacticalMapId = defaultMapId): PlayerSnapshot => {
  const inventory = inventoryDefaults();
  const map = getTacticalMap(mapId);

  return {
    id: 'local-player',
    health: 100,
    armor: 50,
    ammoInMagazine: 0,
    reserveAmmo: 0,
    grenades: 0,
    weaponSlot: 'knife',
    previousWeaponSlot: 'knife',
    inventory,
    isReloading: false,
    reloadProgress: 0,
    isZooming: false,
    recoilImpulse: 0,
    knifeSlashImpulse: 0,
    position: { ...map.playerStart },
    yaw: 0,
    pitch: 0,
  };
};

const enemyDefaults = (count = maxTeamSize, mapId: TacticalMapId = defaultMapId): EnemySnapshot[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `enemy-${index + 1}`,
    team: 'enemy',
    health: 100,
    position: spawnForEnemyIndex(index, mapId),
    alive: true,
    aiState: 'idle',
    nextShotAtSeconds: performance.now() / 1000 + 1.8 + index * 0.35 + Math.random() * 1.2,
    stateUntilSeconds: 0,
    strafeDirection: index % 2 === 0 ? 1 : -1,
    respawnAtSeconds: 0,
  }));

const createLobbyCode = (): string => Math.random().toString(36).slice(2, 7).toUpperCase();

const lobbyPlayer = (
  index: number,
  team: LobbyPlayer['team'],
  isHost = false,
  isLocal = false,
): LobbyPlayer => ({
  id: `${team}-${index + 1}`,
  name: isLocal ? 'You' : `${team === 'friendly' ? 'Alpha' : 'Bravo'} ${index + 1}`,
  team,
  isHost,
  isLocal,
  ready: true,
});

const teamForLobbyPlayer = (players: LobbyPlayer[], playerId: string): LobbyPlayer['team'] => (
  players.find((player) => player.id === playerId)?.team ?? 'friendly'
);

const teamIndexForLobbyPlayer = (players: LobbyPlayer[], playerId: string): number => {
  const player = players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return 0;
  }

  return Math.max(0, players.filter((candidate) => candidate.team === player.team).indexOf(player));
};

export const useGameState = defineStore('game-state', {
  state: (): TacticalWorldState => ({
    phase: 'preload',
    lobby: {
      mode: null,
      lobbyCode: '',
      isHost: false,
      localPlayerId: '',
      teamSize: maxTeamSize,
      mapId: defaultMapId,
      players: [],
    },
    selectedMapId: defaultMapId,
    localPlayer: localPlayerDefaults(),
    remotePlayers: [],
    enemies: enemyDefaults(),
    bulletTrails: [],
    winnerName: '',
    winnerTeam: null,
    score: 0,
    kills: 0,
    keyBindings: defaultKeyBindings(),
    isBuyMenuOpen: false,
    isInBuyZone: true,
    isGameOver: false,
    roundTimeSeconds: 100,
    isPointerLocked: false,
  }),
  getters: {
    canStartLobby: (state): boolean => {
      const friendlyCount = state.lobby.players.filter((player) => player.team === 'friendly').length;
      const enemyCount = state.lobby.players.filter((player) => player.team === 'enemy').length;
      return state.lobby.isHost && friendlyCount === state.lobby.teamSize && enemyCount === state.lobby.teamSize;
    },
    selectedMap: (state) => getTacticalMap(state.selectedMapId),
  },
  actions: {
    chooseSolo(teamSize = 1, mapId?: TacticalMapId) {
      const safeTeamSize = Math.max(1, Math.min(maxTeamSize, Math.round(teamSize)));
      const selectedMapId = mapId ?? this.selectedMapId;
      this.selectedMapId = selectedMapId;
      this.lobby = {
        mode: 'solo',
        lobbyCode: 'LOCAL',
        isHost: true,
        localPlayerId: 'local-player',
        teamSize: safeTeamSize,
        mapId: selectedMapId,
        players: [
          lobbyPlayer(0, 'friendly', true, true),
          ...Array.from({ length: safeTeamSize }, (_, index) => lobbyPlayer(index, 'enemy')),
        ],
      };
      this.prepareMatch();
      this.phase = 'loading';
    },
    createMultiplayerLobby(teamSize: number, mapId?: TacticalMapId) {
      const safeTeamSize = Math.max(1, Math.min(maxTeamSize, Math.round(teamSize)));
      const selectedMapId = mapId ?? this.selectedMapId;
      this.selectedMapId = selectedMapId;
      this.lobby = {
        mode: 'multiplayer',
        lobbyCode: createLobbyCode(),
        isHost: true,
        localPlayerId: 'local-host',
        teamSize: safeTeamSize,
        mapId: selectedMapId,
        players: [lobbyPlayer(0, 'friendly', true, true)],
      };
      this.phase = 'lobby';
    },
    syncNetworkLobby(payload: { code: string; teamSize: number; mapId?: TacticalMapId; players: LobbyPlayer[]; started: boolean }, playerId: string, isHost: boolean) {
      const mapId = payload.mapId ?? defaultMapId;
      this.selectedMapId = mapId;
      this.lobby = {
        mode: 'multiplayer',
        lobbyCode: payload.code,
        isHost,
        localPlayerId: playerId,
        teamSize: payload.teamSize,
        mapId,
        players: payload.players.map((player) => ({
          ...player,
          isLocal: player.id === playerId,
        })),
      };

      if (payload.started && this.phase === 'lobby') {
        this.prepareMatch();
        this.phase = 'loading';
        return;
      }

      if (this.phase === 'preload') {
        this.phase = 'lobby';
      }
    },
    addLobbyBot(team: LobbyPlayer['team']) {
      if (this.phase !== 'lobby') {
        return;
      }

      const existingTeamCount = this.lobby.players.filter((player) => player.team === team).length;
      if (existingTeamCount >= this.lobby.teamSize) {
        return;
      }

      this.lobby.players.push(lobbyPlayer(existingTeamCount, team));
    },
    fillLobby() {
      (['friendly', 'enemy'] as const).forEach((team) => {
        while (this.lobby.players.filter((player) => player.team === team).length < this.lobby.teamSize) {
          this.addLobbyBot(team);
        }
      });
    },
    setLobbyTeamSize(teamSize: number) {
      const safeTeamSize = Math.max(1, Math.min(maxTeamSize, Math.round(teamSize)));
      this.lobby.teamSize = safeTeamSize;
      const seenTeams: Record<LobbyPlayer['team'], number> = { friendly: 0, enemy: 0 };
      this.lobby.players = this.lobby.players.filter((player) => {
        seenTeams[player.team] += 1;
        return player.isLocal || seenTeams[player.team] <= safeTeamSize;
      });
    },
    startLobbyMatch() {
      if (!this.canStartLobby) {
        return;
      }

      this.prepareMatch();
      this.phase = 'loading';
    },
    enterPlaying() {
      if (this.phase === 'loading') {
        this.phase = 'playing';
      }
    },
    backToPreload() {
      this.phase = 'preload';
      this.lobby.mode = null;
      this.lobby.localPlayerId = '';
      this.remotePlayers = [];
      this.bulletTrails = [];
      this.winnerName = '';
      this.winnerTeam = null;
      this.isBuyMenuOpen = false;
      document.exitPointerLock();
    },
    prepareMatch() {
      const map = getTacticalMap(this.selectedMapId);
      const teamSize = this.lobby.teamSize || maxTeamSize;
      const localTeam = teamForLobbyPlayer(this.lobby.players, this.lobby.localPlayerId);
      const localTeamIndex = teamIndexForLobbyPlayer(this.lobby.players, this.lobby.localPlayerId);
      const player = localPlayerDefaults(this.selectedMapId);
      const starts = localTeam === 'friendly' ? map.allyStarts : map.enemyStarts;
      const start = starts[localTeamIndex] ?? starts[0] ?? map.playerStart;
      player.position = { x: start.x, y: 1.8, z: start.z };
      player.yaw = localTeam === 'friendly' ? Math.PI : 0;
      this.localPlayer = player;
      this.enemies = this.lobby.mode === 'multiplayer' && this.lobby.lobbyCode !== 'LOCAL' ? [] : enemyDefaults(teamSize, this.selectedMapId);
      this.remotePlayers = [];
      this.bulletTrails = [];
      this.score = 0;
      this.kills = 0;
      this.winnerName = '';
      this.winnerTeam = null;
      this.isBuyMenuOpen = false;
      this.isGameOver = false;
      this.roundTimeSeconds = 100;
      this.isInBuyZone = true;
    },
    applyNetworkMatch(match: NetworkMatchState) {
      const localId = this.lobby.localPlayerId;
      const localRemote = match.players.find((player) => player.id === localId);
      const shouldReloadRestartedNetworkRound = this.isGameOver && !match.gameOver && localRemote?.alive;
      if (shouldReloadRestartedNetworkRound) {
        this.prepareMatch();
        this.phase = 'loading';
      }

      this.remotePlayers = match.players.filter((player) => player.id !== localId);
      this.winnerName = match.winnerName;
      this.winnerTeam = match.winnerTeam;

      if (localRemote) {
        this.localPlayer.health = localRemote.health;
        this.localPlayer.position = { ...localRemote.position };
        this.localPlayer.yaw = localRemote.yaw;
        this.localPlayer.pitch = localRemote.pitch;
        if (!localRemote.alive) {
          this.isGameOver = true;
          document.exitPointerLock();
        }
      }

      if (match.gameOver) {
        this.isGameOver = true;
        document.exitPointerLock();
      } else if (localRemote?.alive) {
        this.isGameOver = false;
      }
    },
    reportRemoteHit(targetId: string, damage: number) {
      if (!this.lobby.lobbyCode || !this.lobby.localPlayerId || this.lobby.lobbyCode === 'LOCAL') {
        return;
      }

      lobbyClient
        .shoot(this.lobby.lobbyCode, this.lobby.localPlayerId, targetId, Math.max(8, Math.ceil(damage * 0.38)))
        .then((response) => this.applyNetworkMatch(response.match))
        .catch(() => undefined);
    },
    setHealth(health: number) {
      this.localPlayer.health = Math.max(0, Math.min(100, Math.round(health)));
      if (this.localPlayer.health === 0) {
        this.isGameOver = true;
        document.exitPointerLock();
      }
    },
    setAmmo(ammoInMagazine: number, reserveAmmo?: number) {
      this.localPlayer.ammoInMagazine = Math.max(0, Math.round(ammoInMagazine));
      this.localPlayer.reserveAmmo = Math.max(0, Math.round(reserveAmmo ?? this.localPlayer.reserveAmmo));

      const activeItem = this.localPlayer.inventory[this.localPlayer.weaponSlot];
      activeItem.ammoInMagazine = this.localPlayer.ammoInMagazine;
      activeItem.reserveAmmo = this.localPlayer.reserveAmmo;
    },
    setPlayerPose(position: Vec3, yaw: number, pitch: number) {
      this.localPlayer.position = { ...position };
      this.localPlayer.yaw = yaw;
      this.localPlayer.pitch = pitch;
      const localTeam = teamForLobbyPlayer(this.lobby.players, this.lobby.localPlayerId);
      const map = getTacticalMap(this.selectedMapId);
      const zone = localTeam === 'friendly' ? map.allyBuyZone : map.enemyBuyZone;
      this.isInBuyZone = isInsideZone(position, zone.center, zone.size);
      if (!this.isInBuyZone && this.isBuyMenuOpen) {
        this.isBuyMenuOpen = false;
      }
    },
    setPointerLocked(isPointerLocked: boolean) {
      this.isPointerLocked = isPointerLocked;
    },
    setZooming(isZooming: boolean) {
      this.localPlayer.isZooming = isZooming;
    },
    addRecoilImpulse(amount: number) {
      this.localPlayer.recoilImpulse = Math.min(1, this.localPlayer.recoilImpulse + amount);
    },
    addKnifeSlashImpulse(amount = 1) {
      this.localPlayer.knifeSlashImpulse = Math.min(1, this.localPlayer.knifeSlashImpulse + amount);
    },
    recordBulletTrail(from: Vec3, to: Vec3, team: BulletTrailSnapshot['team']) {
      const nowSeconds = performance.now() / 1000;
      this.bulletTrails = [
        ...this.bulletTrails.filter((trail) => trail.expiresAtSeconds > nowSeconds).slice(-22),
        {
          id: `${team}-${nowSeconds.toFixed(4)}-${Math.random().toString(36).slice(2, 7)}`,
          from: { ...from },
          to: { ...to },
          team,
          createdAtSeconds: nowSeconds,
          expiresAtSeconds: nowSeconds + 0.16,
        },
      ];
    },
    consumeRecoilImpulse(amount: number) {
      this.localPlayer.recoilImpulse = Math.max(0, this.localPlayer.recoilImpulse - amount);
    },
    consumeKnifeSlashImpulse(amount: number) {
      this.localPlayer.knifeSlashImpulse = Math.max(0, this.localPlayer.knifeSlashImpulse - amount);
    },
    setKeyBinding(action: keyof KeyBindings, code: string) {
      this.keyBindings[action] = code;
    },
    setBuyMenuOpen(isOpen: boolean) {
      if (this.isGameOver) {
        return;
      }

      if (isOpen && !this.isInBuyZone) {
        this.isBuyMenuOpen = false;
        return;
      }

      this.isBuyMenuOpen = isOpen;
      if (isOpen) {
        document.exitPointerLock();
      }
    },
    toggleBuyMenu() {
      this.setBuyMenuOpen(!this.isBuyMenuOpen);
    },
    buy(action: BuyAction) {
      if (!this.isInBuyZone) {
        return;
      }

      if (action === 'buyGrenade') {
        this.buyWeapon('frag');
        return;
      }

      if (action === 'buyKevlar') {
        this.localPlayer.armor = 100;
        return;
      }

      this.buyWeapon(action === 'buyPrimary' ? defaultWeaponForSlot.primary : defaultWeaponForSlot.secondary);
    },
    buyWeapon(weaponId: WeaponId) {
      if (!this.isInBuyZone) {
        return;
      }

      const weapon = getWeapon(weaponId);

      if (weapon.category === 'grenade') {
        this.localPlayer.grenades = Math.min(4, this.localPlayer.grenades + 1);
        return;
      }

      if (weapon.slot === 'knife') {
        return;
      }

      const item = this.localPlayer.inventory[weapon.slot];
      item.owned = true;
      item.weaponId = weapon.id;
      item.ammoInMagazine = weapon.magazineSize;
      item.reserveAmmo = weapon.reserveAmmo;

      if (this.localPlayer.weaponSlot === weapon.slot) {
        this.localPlayer.ammoInMagazine = item.ammoInMagazine;
        this.localPlayer.reserveAmmo = item.reserveAmmo;
        this.localPlayer.isReloading = false;
        this.localPlayer.reloadProgress = 0;
        return;
      }

      this.switchWeapon(weapon.slot);
    },
    switchWeapon(slot: WeaponSlot) {
      const item = this.localPlayer.inventory[slot];
      if (!item.owned || this.localPlayer.weaponSlot === slot) {
        return;
      }

      this.localPlayer.previousWeaponSlot = this.localPlayer.weaponSlot;
      this.localPlayer.weaponSlot = slot;
      this.localPlayer.ammoInMagazine = item.ammoInMagazine;
      this.localPlayer.reserveAmmo = item.reserveAmmo;
      this.localPlayer.isReloading = false;
      this.localPlayer.reloadProgress = 0;
    },
    quickSwitchWeapon() {
      this.switchWeapon(this.localPlayer.previousWeaponSlot);
    },
    addAmmo(slot: Exclude<WeaponSlot, 'knife'>) {
      const item = this.localPlayer.inventory[slot];
      if (!item.owned) {
        return;
      }

      const weapon = getWeapon(item.weaponId);
      item.reserveAmmo += weapon.reserveAmmo;

      if (this.localPlayer.weaponSlot === slot) {
        this.localPlayer.reserveAmmo = item.reserveAmmo;
      }
    },
    startReload() {
      if (this.localPlayer.weaponSlot === 'knife') {
        return;
      }

      const activeItem = this.localPlayer.inventory[this.localPlayer.weaponSlot];
      const weapon = getWeapon(activeItem.weaponId);
      if (
        this.localPlayer.isReloading ||
        this.localPlayer.reserveAmmo <= 0 ||
        this.localPlayer.ammoInMagazine >= weapon.magazineSize
      ) {
        return;
      }

      this.localPlayer.isReloading = true;
      this.localPlayer.reloadProgress = 0;
    },
    setReloadProgress(progress: number) {
      this.localPlayer.reloadProgress = Math.max(0, Math.min(1, progress));
    },
    finishReload() {
      if (this.localPlayer.weaponSlot === 'knife') {
        return;
      }

      const activeItem = this.localPlayer.inventory[this.localPlayer.weaponSlot];
      const weapon = getWeapon(activeItem.weaponId);
      const needed = weapon.magazineSize - this.localPlayer.ammoInMagazine;
      const loaded = Math.min(needed, this.localPlayer.reserveAmmo);

      this.localPlayer.ammoInMagazine += loaded;
      this.localPlayer.reserveAmmo -= loaded;
      activeItem.ammoInMagazine = this.localPlayer.ammoInMagazine;
      activeItem.reserveAmmo = this.localPlayer.reserveAmmo;
      this.localPlayer.isReloading = false;
      this.localPlayer.reloadProgress = 0;
    },
    damageEnemy(enemyId: string, damage: number) {
      if (this.isGameOver) {
        return;
      }

      const enemy = this.enemies.find((target) => target.id === enemyId);
      if (!enemy || !enemy.alive || enemy.team !== 'enemy') {
        return;
      }

      enemy.health = Math.max(0, enemy.health - damage);
      if (enemy.health === 0) {
        enemy.alive = false;
        enemy.aiState = 'death';
        enemy.stateUntilSeconds = performance.now() / 1000 + 0.9;
        enemy.respawnAtSeconds = performance.now() / 1000 + 1.25;
        if (enemy.team === 'enemy') {
          this.kills += 1;
          this.score += 100;
        }
      }
    },
    updateEnemyRespawns(nowSeconds: number) {
      this.enemies.forEach((enemy) => {
        if (enemy.team === 'enemy' && !enemy.alive && enemy.respawnAtSeconds <= nowSeconds) {
          enemy.health = 100;
          enemy.position = randomSpawn(this.selectedMapId);
          enemy.alive = true;
          enemy.aiState = 'idle';
          enemy.nextShotAtSeconds = nowSeconds + 1.5 + Math.random() * 0.8;
          enemy.stateUntilSeconds = 0;
          enemy.respawnAtSeconds = 0;
        }
      });
    },
    moveEnemy(enemyId: string, position: Vec3) {
      const enemy = this.enemies.find((target) => target.id === enemyId);
      if (!enemy || !enemy.alive || enemy.team !== 'enemy' || this.isGameOver) {
        return;
      }

      enemy.position = { ...position };
    },
    setEnemyNextShot(enemyId: string, nextShotAtSeconds: number) {
      const enemy = this.enemies.find((target) => target.id === enemyId);
      if (!enemy) {
        return;
      }

      enemy.nextShotAtSeconds = nextShotAtSeconds;
    },
    setEnemyAiState(enemyId: string, aiState: EnemySnapshot['aiState'], stateUntilSeconds = 0) {
      const enemy = this.enemies.find((target) => target.id === enemyId);
      if (!enemy) {
        return;
      }

      enemy.aiState = aiState;
      enemy.stateUntilSeconds = stateUntilSeconds;
    },
    damagePlayer(damage: number) {
      if (this.isGameOver) {
        return;
      }

      const armorAbsorb = Math.min(this.localPlayer.armor, Math.floor(damage * 0.5));
      this.localPlayer.armor -= armorAbsorb;
      this.setHealth(this.localPlayer.health - (damage - armorAbsorb));
    },
    restartMatch() {
      if (this.lobby.mode === 'multiplayer' && this.lobby.lobbyCode !== 'LOCAL' && this.lobby.localPlayerId) {
        lobbyClient
          .restart(this.lobby.lobbyCode, this.lobby.localPlayerId)
          .then((response) => {
            this.resetRoundState();
            this.applyNetworkMatch(response.match);
            this.isGameOver = false;
            this.phase = 'loading';
          })
          .catch(() => {
            this.prepareMatch();
            this.phase = 'loading';
          });
        return;
      }

      this.prepareMatch();
      this.phase = 'loading';
    },
    resetRoundState() {
      this.bulletTrails = [];
      this.score = 0;
      this.kills = 0;
      this.winnerName = '';
      this.winnerTeam = null;
      this.isBuyMenuOpen = false;
      this.isGameOver = false;
      this.roundTimeSeconds = 100;
      this.isInBuyZone = true;
      this.localPlayer = {
        ...this.localPlayer,
        health: 100,
        armor: 50,
        isReloading: false,
        reloadProgress: 0,
        isZooming: false,
        recoilImpulse: 0,
        knifeSlashImpulse: 0,
      };
    },
  },
});
