<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { getTacticalMap } from '../../game/domain/deathmatch1Map';
import { getWeapon } from '../../game/domain/weapons';
import { useGameState } from '../../game/state/useGameState';
import type { CombatantTeam, Vec3 } from '../../game/types/game';

interface RosterRow {
  id: string;
  name: string;
  health: number;
  status: 'ACTIVE' | 'DOWN';
  isLocal?: boolean;
}

const store = useGameState();
const {
  enemies,
  isInBuyZone,
  kills,
  lobby,
  localPlayer,
  remotePlayers,
  roundTimeSeconds,
  score,
  selectedMapId,
} = storeToRefs(store);

const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const selectedMap = computed(() => getTacticalMap(selectedMapId.value));
const damageFlashKey = ref(0);

const localTeam = computed<CombatantTeam>(() =>
  lobby.value.players.find((player) => player.id === lobby.value.localPlayerId)?.team ?? 'friendly',
);

const healthStatus = computed(() => {
  if (localPlayer.value.health > 60) {
    return 'stable';
  }

  if (localPlayer.value.health > 25) {
    return 'wounded';
  }

  return 'critical';
});

const roundClock = computed(() => {
  const minutes = Math.floor(roundTimeSeconds.value / 60);
  const seconds = Math.floor(roundTimeSeconds.value % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes}:${seconds}`;
});

const headingDegrees = computed(() => {
  const normalized = ((localPlayer.value.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.round((normalized / (Math.PI * 2)) * 360);
});

const compassDirection = computed(() => directions[Math.round(headingDegrees.value / 45) % directions.length]);

const compassTicks = computed(() =>
  [-45, -30, -15, 0, 15, 30, 45].map((offset) => {
    const degrees = (headingDegrees.value + offset + 360) % 360;
    return {
      degrees,
      label: offset === 0 ? compassDirection.value : degrees.toString().padStart(3, '0'),
      major: offset === 0 || Math.abs(offset) === 45,
    };
  }),
);

const activeWeapon = computed(() => {
  const item = localPlayer.value.inventory[localPlayer.value.weaponSlot];
  return getWeapon(item.weaponId);
});

const weaponMode = computed(() => {
  if (localPlayer.value.weaponSlot === 'knife') {
    return 'MELEE';
  }

  return activeWeapon.value.category === 'rifle' ? 'AUTO' : 'SEMI';
});

const sector = computed(() => {
  const xSector = Math.max(1, Math.min(6, Math.floor((localPlayer.value.position.x + selectedMap.value.floorSize.x / 2) / 10) + 1));
  const zSector = Math.max(1, Math.min(6, Math.floor((localPlayer.value.position.z + selectedMap.value.floorSize.z / 2) / 10) + 1));
  return `${String.fromCharCode(64 + zSector)}-${xSector}`;
});

const healthPercent = computed(() => Math.max(0, Math.min(100, localPlayer.value.health)));
const armorPercent = computed(() => Math.max(0, Math.min(100, localPlayer.value.armor)));

const mapPoint = (position: Vec3) => ({
  left: `${((position.x + selectedMap.value.floorSize.x / 2) / selectedMap.value.floorSize.x) * 100}%`,
  top: `${((position.z + selectedMap.value.floorSize.z / 2) / selectedMap.value.floorSize.z) * 100}%`,
});

const localRosterRow = computed<RosterRow>(() => ({
  id: lobby.value.localPlayerId || 'local',
  name: 'YOU',
  health: localPlayer.value.health,
  status: localPlayer.value.health > 0 ? 'ACTIVE' : 'DOWN',
  isLocal: true,
}));

const allyBotRows = computed<RosterRow[]>(() =>
  lobby.value.players
    .filter((player) => player.team === localTeam.value && player.id !== lobby.value.localPlayerId)
    .map((player) => ({
      id: player.id,
      name: player.name,
      health: 100,
      status: 'ACTIVE',
    })),
);

const remoteRowsForTeam = (team: CombatantTeam): RosterRow[] =>
  remotePlayers.value
    .filter((player) => player.team === team)
    .map((player) => ({
      id: player.id,
      name: player.name,
      health: player.health,
      status: player.alive ? 'ACTIVE' : 'DOWN',
    }));

const blueRoster = computed<RosterRow[]>(() => {
  const localRows = localTeam.value === 'friendly' ? [localRosterRow.value] : [];
  const networkRows = remoteRowsForTeam('friendly');
  const botRows = lobby.value.lobbyCode === 'LOCAL' && localTeam.value === 'friendly' ? allyBotRows.value : [];

  return [...localRows, ...networkRows, ...botRows].slice(0, 5);
});

const redRoster = computed<RosterRow[]>(() => {
  const localRows = localTeam.value === 'enemy' ? [localRosterRow.value] : [];
  const networkRows = remoteRowsForTeam('enemy');
  const aiRows = enemies.value.map((enemy, index) => ({
    id: enemy.id,
    name: `HOSTILE ${index + 1}`,
    health: enemy.health,
    status: enemy.alive ? 'ACTIVE' : 'DOWN',
  }) satisfies RosterRow);

  return [...localRows, ...networkRows, ...aiRows].slice(0, 5);
});

const blueAliveCount = computed(() => blueRoster.value.filter((member) => member.status === 'ACTIVE').length);
const redAliveCount = computed(() => redRoster.value.filter((member) => member.status === 'ACTIVE').length);

const visibleHostiles = computed(() => [
  ...remotePlayers.value
    .filter((player) => player.team !== localTeam.value && player.alive)
    .map((player) => ({ id: player.id, position: player.position })),
  ...enemies.value
    .filter((enemy) => enemy.alive)
    .map((enemy) => ({ id: enemy.id, position: enemy.position })),
]);

watch(
  () => localPlayer.value.health,
  (health, previousHealth) => {
    if (previousHealth !== undefined && health < previousHealth) {
      damageFlashKey.value += 1;
    }
  },
);
</script>

<template>
  <aside class="hud-root" aria-label="Tactical combat HUD">
    <div :key="damageFlashKey" class="damage-flash" />

    <section class="compass-strip" aria-label="Compass">
      <span
        v-for="tick in compassTicks"
        :key="`${tick.degrees}-${tick.label}`"
        :data-major="tick.major"
      >
        {{ tick.label }}
      </span>
      <strong>{{ headingDegrees.toString().padStart(3, '0') }}</strong>
    </section>

    <section class="life-strip" :data-status="healthStatus" aria-label="Life bar">
      <div class="life-meta">
        <span>LIFE</span>
        <strong>{{ localPlayer.health }}</strong>
      </div>
      <div class="life-track">
        <i :style="{ transform: `scaleX(${healthPercent / 100})` }" />
      </div>
      <em>ARMOR {{ localPlayer.armor }}</em>
    </section>

    <section class="left-stack">
      <div class="panel minimap-panel">
        <header>
      <span>{{ selectedMap.displayName }}</span>
          <strong>{{ sector }}</strong>
        </header>
        <div class="minimap">
          <i class="map-grid" />
          <span class="map-base friendly" />
          <span class="map-base enemy" />
          <b class="map-player" :style="mapPoint(localPlayer.position)">A</b>
          <b
            v-for="hostile in visibleHostiles"
            :key="hostile.id"
            class="map-hostile"
            :style="mapPoint(hostile.position)"
          />
        </div>
      </div>

      <div class="panel squad-panel">
        <header>
          <span>ROSTER</span>
          <strong>{{ blueAliveCount }}B / {{ redAliveCount }}R</strong>
        </header>
        <div class="roster-columns">
          <section>
            <h2>BLUE</h2>
            <ul>
              <li v-for="member in blueRoster" :key="member.id" :data-status="member.status" :data-local="member.isLocal">
                <span>{{ member.name }}</span>
                <i>{{ member.health }}</i>
                <em>{{ member.status }}</em>
              </li>
            </ul>
          </section>
          <section>
            <h2>RED</h2>
            <ul>
              <li v-for="member in redRoster" :key="member.id" :data-status="member.status" :data-local="member.isLocal">
                <span>{{ member.name }}</span>
                <i>{{ member.health }}</i>
                <em>{{ member.status }}</em>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </section>

    <section class="mission-strip">
      <span>TIME {{ roundClock }}</span>
      <span>KIA {{ kills }}</span>
      <span>POINTS {{ score }}</span>
      <span>{{ isInBuyZone ? 'ARMORY ACCESS' : 'FIELD OPERATIONS' }}</span>
    </section>

    <section class="bottom-left panel vitals-panel" :data-status="healthStatus">
      <div>
        <span>VITALS</span>
        <strong>{{ localPlayer.health }}</strong>
      </div>
      <div class="meter">
        <i :style="{ transform: `scaleX(${healthPercent / 100})` }" />
      </div>
      <div class="armor-row">
        <span>ARMOR</span>
        <b>{{ localPlayer.armor }}</b>
        <div class="meter armor">
          <i :style="{ transform: `scaleX(${armorPercent / 100})` }" />
        </div>
      </div>
    </section>

    <section class="bottom-right panel weapon-panel">
      <header>
        <span>{{ weaponMode }}</span>
        <strong>{{ activeWeapon.name }}</strong>
      </header>
      <div class="ammo-readout">
        <strong>{{ localPlayer.ammoInMagazine.toString().padStart(2, '0') }}</strong>
        <span>{{ localPlayer.reserveAmmo.toString().padStart(2, '0') }}</span>
      </div>
      <footer>
        <span>{{ localPlayer.isReloading ? 'RELOAD' : 'READY' }}</span>
        <span>GREN {{ localPlayer.grenades }}</span>
      </footer>
      <div class="slot-row">
        <span :data-owned="localPlayer.inventory.primary.owned">1</span>
        <span :data-owned="localPlayer.inventory.secondary.owned">2</span>
        <span data-owned="true">3</span>
        <span :data-owned="localPlayer.grenades > 0">{{ localPlayer.grenades }}</span>
      </div>
      <div v-if="localPlayer.isReloading" class="reload-meter">
        <i :style="{ transform: `scaleX(${localPlayer.reloadProgress})` }" />
      </div>
    </section>
  </aside>
</template>

<style scoped>
.hud-root {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  color: #d8ded7;
  font-family: "Segoe UI", ui-sans-serif, system-ui, sans-serif;
}

.damage-flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 50%, transparent 0 36%, rgba(132, 0, 12, 0.24) 64%, rgba(255, 18, 42, 0.52) 100%),
    rgba(255, 18, 42, 0.18);
  opacity: 0;
  animation: damage-blink 520ms ease-out;
  mix-blend-mode: screen;
}

@keyframes damage-blink {
  0% {
    opacity: 0;
  }

  8% {
    opacity: 1;
  }

  38% {
    opacity: 0.62;
  }

  100% {
    opacity: 0;
  }
}

.panel,
.compass-strip,
.mission-strip {
  border: 1px solid rgba(176, 190, 168, 0.28);
  border-radius: 2px;
  background: rgba(12, 18, 15, 0.58);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(3px);
}

.compass-strip {
  position: absolute;
  top: 14px;
  left: 50%;
  display: grid;
  grid-template-columns: repeat(7, 48px) 58px;
  align-items: center;
  min-height: 34px;
  transform: translateX(-50%);
}

.compass-strip span,
.compass-strip strong {
  display: grid;
  place-items: center;
  color: #aeb8a9;
  font-family: Consolas, "Segoe UI Mono", monospace;
  font-size: 11px;
  font-weight: 800;
}

.compass-strip span[data-major="true"],
.compass-strip strong {
  color: #e8eddf;
}

.compass-strip strong {
  height: 100%;
  border-left: 1px solid rgba(176, 190, 168, 0.24);
  background: rgba(107, 126, 82, 0.18);
}

.left-stack {
  position: absolute;
  top: 92px;
  left: 18px;
  display: grid;
  gap: 10px;
  width: 218px;
}

.life-strip {
  position: absolute;
  top: 56px;
  left: 50%;
  display: grid;
  grid-template-columns: 72px minmax(280px, 38vw) 92px;
  align-items: center;
  min-height: 32px;
  border: 1px solid rgba(176, 190, 168, 0.3);
  background: rgba(12, 18, 15, 0.7);
  transform: translateX(-50%);
  backdrop-filter: blur(3px);
}

.life-meta,
.life-strip em {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 100%;
  color: #cbd9bf;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.life-meta {
  border-right: 1px solid rgba(176, 190, 168, 0.2);
}

.life-meta span {
  color: #9ca895;
}

.life-meta strong {
  color: #e8eddf;
  font-family: Consolas, "Segoe UI Mono", monospace;
  font-size: 18px;
}

.life-strip em {
  border-left: 1px solid rgba(176, 190, 168, 0.2);
}

.life-track {
  position: relative;
  overflow: hidden;
  height: 14px;
  margin: 0 8px;
  border: 1px solid rgba(176, 190, 168, 0.22);
  background:
    repeating-linear-gradient(
      90deg,
      rgba(232, 237, 223, 0.12) 0,
      rgba(232, 237, 223, 0.12) 1px,
      transparent 1px,
      transparent 20px
    ),
    rgba(0, 0, 0, 0.26);
}

.life-track i {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #6f875b, #c8d7b5);
  transform-origin: left center;
}

.life-strip[data-status="wounded"] .life-track i {
  background: linear-gradient(90deg, #b8964f, #e2c675);
}

.life-strip[data-status="critical"] .life-track i {
  background: linear-gradient(90deg, #9f4f42, #d28b72);
}

.panel header,
.mission-strip,
.weapon-panel footer,
.armor-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.panel header {
  min-height: 28px;
  padding: 0 9px;
  border-bottom: 1px solid rgba(176, 190, 168, 0.18);
}

.panel header span,
.mission-strip span,
.weapon-panel footer span,
.vitals-panel span,
.armor-row span {
  color: #9ca895;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.panel header strong {
  color: #cbd9bf;
  font-size: 11px;
}

.minimap {
  position: relative;
  overflow: hidden;
  height: 158px;
  margin: 8px;
  border: 1px solid rgba(176, 190, 168, 0.22);
  background: rgba(22, 30, 26, 0.72);
}

.map-grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(176, 190, 168, 0.14) 1px, transparent 1px) 0 0 / 25% 25%,
    linear-gradient(180deg, rgba(176, 190, 168, 0.14) 1px, transparent 1px) 0 0 / 25% 25%;
}

.map-base,
.map-player,
.map-hostile {
  position: absolute;
  transform: translate(-50%, -50%);
}

.map-base {
  width: 35%;
  height: 13%;
  border: 1px solid currentColor;
}

.map-base.friendly {
  left: 50%;
  top: 89%;
  color: rgba(103, 139, 111, 0.8);
}

.map-base.enemy {
  left: 50%;
  top: 11%;
  color: rgba(166, 91, 76, 0.82);
}

.map-player {
  display: grid;
  place-items: center;
  width: 18px;
  aspect-ratio: 1;
  border: 1px solid rgba(232, 237, 223, 0.82);
  background: rgba(232, 237, 223, 0.18);
  color: #f2f6e9;
  font-family: Consolas, "Segoe UI Mono", monospace;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  box-shadow: 0 0 14px rgba(232, 237, 223, 0.38);
}

.map-hostile {
  width: 7px;
  aspect-ratio: 1;
  border: 1px solid #d28b72;
  background: rgba(210, 139, 114, 0.72);
}

.roster-columns {
  display: grid;
  gap: 8px;
  padding: 8px;
}

.roster-columns h2 {
  margin: 0 0 5px;
  color: #cbd9bf;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.roster-columns section:first-child h2 {
  color: #91b8c7;
}

.roster-columns section:last-child h2 {
  color: #d28b72;
}

.squad-panel ul {
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.squad-panel li {
  display: grid;
  grid-template-columns: 1fr 34px 54px;
  align-items: center;
  min-height: 24px;
  padding: 0 7px;
  border-left: 2px solid #7b8b65;
  background: rgba(255, 255, 255, 0.045);
  color: #dce3d7;
  font-size: 11px;
  font-weight: 800;
}

.squad-panel li[data-local="true"] {
  background: rgba(232, 237, 223, 0.11);
}

.squad-panel li[data-status="DOWN"] {
  border-left-color: #ad5f4f;
  opacity: 0.72;
}

.squad-panel i,
.squad-panel em {
  color: #9ca895;
  font-size: 10px;
  font-style: normal;
  text-align: right;
}

.mission-strip {
  position: absolute;
  right: 18px;
  bottom: 126px;
  min-width: 430px;
  min-height: 30px;
  padding: 0 10px;
}

.bottom-left,
.bottom-right {
  position: absolute;
  bottom: 18px;
}

.bottom-left {
  left: 18px;
  width: 218px;
  padding: 10px;
}

.vitals-panel > div:first-child {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.vitals-panel strong {
  color: #dce8d3;
  font-family: Consolas, "Segoe UI Mono", monospace;
  font-size: 34px;
  line-height: 1;
}

.vitals-panel[data-status="wounded"] strong {
  color: #d6b66e;
}

.vitals-panel[data-status="critical"] strong {
  color: #d28b72;
}

.meter {
  position: relative;
  overflow: hidden;
  height: 8px;
  margin-top: 7px;
  border: 1px solid rgba(176, 190, 168, 0.2);
  background: rgba(0, 0, 0, 0.22);
}

.meter i {
  position: absolute;
  inset: 0;
  background: #7b8b65;
  transform-origin: left center;
}

.meter.armor {
  flex: 1;
  margin-top: 0;
}

.meter.armor i {
  background: #9ca895;
}

.armor-row {
  margin-top: 9px;
}

.armor-row b {
  color: #dce3d7;
  font-size: 11px;
}

.bottom-right {
  right: 18px;
  width: 260px;
}

.weapon-panel {
  padding-bottom: 10px;
}

.ammo-readout {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 12px;
  padding: 8px 10px 2px;
  font-family: Consolas, "Segoe UI Mono", monospace;
}

.ammo-readout strong {
  color: #e8eddf;
  font-size: 48px;
  line-height: 0.95;
}

.ammo-readout span {
  color: #9ca895;
  font-size: 24px;
  font-weight: 900;
}

.weapon-panel footer {
  padding: 0 10px;
}

.slot-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 8px 10px 0;
}

.slot-row span {
  display: grid;
  place-items: center;
  min-height: 28px;
  border: 1px solid rgba(176, 190, 168, 0.18);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(220, 227, 215, 0.42);
  font-size: 12px;
  font-weight: 900;
}

.slot-row span[data-owned="true"] {
  border-color: rgba(176, 190, 168, 0.36);
  color: #e8eddf;
  background: rgba(123, 139, 101, 0.18);
}

.reload-meter {
  position: relative;
  overflow: hidden;
  height: 3px;
  margin: 7px 10px 0;
  background: rgba(0, 0, 0, 0.28);
}

.reload-meter i {
  position: absolute;
  inset: 0;
  background: #d6b66e;
  transform-origin: left center;
}

@media (max-width: 760px) {
  .left-stack {
    top: 90px;
    left: 10px;
    width: 154px;
  }

  .minimap {
    height: 112px;
  }

  .compass-strip {
    top: 8px;
    grid-template-columns: repeat(7, 34px) 46px;
  }

  .life-strip {
    top: 52px;
    grid-template-columns: 58px minmax(140px, 1fr) 72px;
    width: calc(100vw - 24px);
  }

  .mission-strip {
    right: 10px;
    bottom: auto;
    left: auto;
    top: 92px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 3px;
    min-width: 0;
    padding: 6px 8px;
  }

  .bottom-left {
    display: none;
  }

  .bottom-right {
    top: 142px;
    right: 10px;
    bottom: auto;
    width: 150px;
  }

  .ammo-readout strong {
    font-size: 32px;
  }

  .ammo-readout span {
    font-size: 16px;
  }

  .weapon-panel footer,
  .slot-row {
    display: none;
  }

  .roster-columns {
    gap: 5px;
    padding: 6px;
  }

  .squad-panel li {
    grid-template-columns: 1fr 28px;
    min-height: 21px;
    font-size: 10px;
  }

  .squad-panel em {
    display: none;
  }
}
</style>
