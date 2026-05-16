<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { defaultMapId, getTacticalMap, tacticalMaps } from '../../game/domain/deathmatch1Map';
import { lobbyApiBase, lobbyClient, type NetworkLobby } from '../../game/network/lobbyClient';
import { useGameState } from '../../game/state/useGameState';
import type { CombatantTeam, TacticalMapId } from '../../game/types/game';

const store = useGameState();
const { canStartLobby, lobby, phase } = storeToRefs(store);
const selectedTeamSize = ref(5);
const selectedAiTeamSize = ref(3);
const selectedMapId = ref<TacticalMapId>(defaultMapId);
const playerName = ref(`Player ${Math.floor(Math.random() * 90) + 10}`);
const joinCode = ref('');
const joinTeam = ref<CombatantTeam>('enemy');
const networkError = ref('');
const serverAddress = ref(lobbyApiBase());
const availableLobbies = ref<NetworkLobby[]>([]);

const friendlyPlayers = computed(() => lobby.value.players.filter((player) => player.team === 'friendly'));
const enemyPlayers = computed(() => lobby.value.players.filter((player) => player.team === 'enemy'));
const lobbyMapName = computed(() => getTacticalMap(lobby.value.mapId).displayName);

let pollInterval: number | undefined;

const requestAimLock = (): void => {
  const lockTarget = document.querySelector<HTMLElement>('[data-game-lock-target]');
  if (!lockTarget || document.pointerLockElement === lockTarget) {
    return;
  }

  const lockResult = lockTarget.requestPointerLock();
  if (lockResult instanceof Promise) {
    lockResult.catch(() => undefined);
  }
};

const startAiMatch = (): void => {
  requestAimLock();
  store.chooseSolo(selectedAiTeamSize.value, selectedMapId.value);
};

const refreshLobbies = async (): Promise<void> => {
  try {
    const response = await lobbyClient.list();
    availableLobbies.value = response.lobbies;
    networkError.value = '';
  } catch (error) {
    networkError.value = error instanceof Error ? error.message : 'Could not reach multiplayer server.';
  }
};

const openHostLobby = async (): Promise<void> => {
  try {
    const response = await lobbyClient.create(selectedTeamSize.value, playerName.value, selectedMapId.value);
    store.syncNetworkLobby(response.lobby, response.playerId, true);
    networkError.value = '';
  } catch (error) {
    networkError.value = error instanceof Error ? error.message : 'Could not create lobby.';
  }
};

const addPlayer = (team: CombatantTeam): void => {
  store.addLobbyBot(team);
};

const updateTeamSize = (event: Event): void => {
  store.setLobbyTeamSize(Number((event.target as HTMLSelectElement).value));
};

const joinLobby = async (code = joinCode.value): Promise<void> => {
  try {
    const response = await lobbyClient.join(code, joinTeam.value, playerName.value);
    store.syncNetworkLobby(response.lobby, response.playerId, false);
    joinCode.value = response.lobby.code;
    networkError.value = '';
  } catch (error) {
    networkError.value = error instanceof Error ? error.message : 'Could not join lobby.';
  }
};

const startNetworkMatch = async (): Promise<void> => {
  requestAimLock();
  try {
    const response = await lobbyClient.start(lobby.value.lobbyCode, lobby.value.localPlayerId);
    store.syncNetworkLobby(response.lobby, lobby.value.localPlayerId, lobby.value.isHost);
  } catch (error) {
    networkError.value = error instanceof Error ? error.message : 'Could not start match.';
  }
};

const pollLobby = async (): Promise<void> => {
  if (phase.value !== 'lobby' || !lobby.value.lobbyCode || !lobby.value.localPlayerId || lobby.value.lobbyCode === 'LOCAL') {
    return;
  }

  try {
    const response = await lobbyClient.get(lobby.value.lobbyCode, lobby.value.localPlayerId);
    store.syncNetworkLobby(response.lobby, lobby.value.localPlayerId, lobby.value.isHost);
    networkError.value = '';
  } catch (error) {
    networkError.value = error instanceof Error ? error.message : 'Lost connection to lobby.';
  }
};

watch(phase, (value) => {
  if (value === 'preload') {
    refreshLobbies();
  }
});

onMounted(async () => {
  try {
    const status = await lobbyClient.status();
    serverAddress.value = status.addresses[0] ? `http://${status.addresses[0]}:${status.port}` : lobbyApiBase();
  } catch {
    serverAddress.value = lobbyApiBase();
  }

  refreshLobbies();
  pollInterval = window.setInterval(() => {
    if (phase.value === 'lobby') {
      pollLobby();
    } else {
      refreshLobbies();
    }
  }, 1200);
});

onBeforeUnmount(() => {
  if (pollInterval) {
    window.clearInterval(pollInterval);
  }
});
</script>

<template>
  <section v-if="phase === 'preload' || phase === 'lobby'" class="preload-shell">
    <div v-if="phase === 'preload'" class="mode-panel">
      <p class="eyebrow">Beng Beng Arena</p>
      <h1>5v5 tactical match</h1>

      <div class="mode-grid">
        <form class="ai-card" @submit.prevent="startAiMatch">
          <strong>Play vs computer</strong>
          <label>
            Enemy squad
            <select v-model.number="selectedAiTeamSize">
              <option v-for="size in 5" :key="size" :value="size">
                1v{{ size }} AI
              </option>
            </select>
          </label>
          <label>
            Map
            <select v-model="selectedMapId">
              <option v-for="map in tacticalMaps" :key="map.id" :value="map.id">
                {{ map.displayName }}
              </option>
            </select>
          </label>
          <button type="submit">Start AI match</button>
        </form>

        <form class="host-card" @submit.prevent="openHostLobby">
          <strong>Host multiplayer</strong>
          <label>
            Player name
            <input v-model.trim="playerName" maxlength="18" type="text">
          </label>
          <label>
            Team size
            <select v-model.number="selectedTeamSize">
              <option v-for="size in 5" :key="size" :value="size">
                {{ size }}v{{ size }}
              </option>
            </select>
          </label>
          <label>
            Map
            <select v-model="selectedMapId">
              <option v-for="map in tacticalMaps" :key="map.id" :value="map.id">
                {{ map.displayName }}
              </option>
            </select>
          </label>
          <button type="submit">Create game</button>
        </form>

        <form class="join-card" @submit.prevent="joinLobby()">
          <strong>Join multiplayer</strong>
          <label>
            Game code
            <input v-model.trim="joinCode" maxlength="5" placeholder="ABCDE" type="text">
          </label>
          <label>
            Team
            <select v-model="joinTeam">
              <option value="enemy">Red base</option>
              <option value="friendly">Blue base</option>
            </select>
          </label>
          <button type="submit">Join game</button>
        </form>
      </div>

      <section class="server-panel">
        <div>
          <strong>LAN server</strong>
          <span>{{ serverAddress }}</span>
        </div>
        <button type="button" @click="refreshLobbies()">Refresh</button>
      </section>

      <section v-if="availableLobbies.length" class="available-panel">
        <button v-for="item in availableLobbies" :key="item.code" type="button" @click="joinLobby(item.code)">
          <strong>{{ item.teamSize }}v{{ item.teamSize }}</strong>
          <span>{{ item.code }}</span>
          <small>{{ getTacticalMap(item.mapId).displayName }}</small>
          <em>{{ item.players.length }}/{{ item.teamSize * 2 }}</em>
        </button>
      </section>

      <p v-if="networkError" class="network-error">{{ networkError }}</p>
    </div>

    <div v-else class="lobby-panel">
      <header class="lobby-header">
        <div>
          <p class="eyebrow">Host lobby</p>
          <h1>{{ lobby.teamSize }}v{{ lobby.teamSize }}</h1>
          <span class="map-name">{{ lobbyMapName }}</span>
        </div>
        <div class="code-box">
          <span>Code</span>
          <strong>{{ lobby.lobbyCode }}</strong>
        </div>
      </header>

      <div class="lobby-tools">
        <label v-if="lobby.isHost && lobby.lobbyCode === 'LOCAL'">
          Team size
          <select :value="lobby.teamSize" @change="updateTeamSize">
            <option v-for="size in 5" :key="size" :value="size">
              {{ size }}v{{ size }}
            </option>
          </select>
        </label>
        <span v-else class="join-url">Join: {{ serverAddress }} code {{ lobby.lobbyCode }}</span>
        <button v-if="lobby.lobbyCode === 'LOCAL'" type="button" @click="store.fillLobby()">Simulate joined players</button>
        <button type="button" @click="store.backToPreload()">Back</button>
      </div>

      <div class="teams">
        <section class="team-column">
          <header>
            <strong>Blue base</strong>
            <span>{{ friendlyPlayers.length }}/{{ lobby.teamSize }}</span>
          </header>
          <ul>
            <li v-for="player in friendlyPlayers" :key="player.id">
              <span>{{ player.name }}</span>
              <em>{{ player.isHost ? 'Host' : 'Ready' }}</em>
            </li>
            <li v-for="slot in lobby.teamSize - friendlyPlayers.length" :key="`friendly-slot-${slot}`" class="empty-slot">
              Waiting for player
            </li>
          </ul>
          <button v-if="lobby.lobbyCode === 'LOCAL'" type="button" :disabled="friendlyPlayers.length >= lobby.teamSize" @click="addPlayer('friendly')">
            Add blue player
          </button>
        </section>

        <section class="team-column enemy">
          <header>
            <strong>Red base</strong>
            <span>{{ enemyPlayers.length }}/{{ lobby.teamSize }}</span>
          </header>
          <ul>
            <li v-for="player in enemyPlayers" :key="player.id">
              <span>{{ player.name }}</span>
              <em>Ready</em>
            </li>
            <li v-for="slot in lobby.teamSize - enemyPlayers.length" :key="`enemy-slot-${slot}`" class="empty-slot">
              Waiting for player
            </li>
          </ul>
          <button v-if="lobby.lobbyCode === 'LOCAL'" type="button" :disabled="enemyPlayers.length >= lobby.teamSize" @click="addPlayer('enemy')">
            Add red player
          </button>
        </section>
      </div>

      <footer class="lobby-footer">
        <span>{{ networkError || 'Waiting for both teams to fill.' }}</span>
        <button v-if="canStartLobby && lobby.lobbyCode === 'LOCAL'" type="button" class="start-button" @click="requestAimLock(); store.startLobbyMatch()">
          Start match
        </button>
        <button v-if="canStartLobby && lobby.lobbyCode !== 'LOCAL'" type="button" class="start-button" @click="startNetworkMatch()">
          Start match
        </button>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.preload-shell {
  position: absolute;
  inset: 0;
  z-index: 12;
  display: grid;
  place-items: center;
  overflow-y: auto;
  padding: 32px;
  background:
    linear-gradient(90deg, rgba(4, 8, 10, 0.88) 0%, rgba(7, 12, 15, 0.48) 48%, rgba(41, 9, 13, 0.82) 100%),
    linear-gradient(180deg, rgba(255, 70, 85, 0.12), rgba(5, 7, 7, 0.9)),
    url('/assets/beng_beng_bg.png') center / cover no-repeat,
    #070909;
  color: #edf8f5;
}

.preload-shell::before {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px) 0 0 / 84px 84px,
    linear-gradient(180deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px) 0 0 / 84px 84px;
  content: "";
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.52), transparent 72%);
}

.mode-panel,
.lobby-panel {
  position: relative;
  width: min(1120px, 100%);
  padding: clamp(18px, 3vw, 30px);
  border: 1px solid rgba(241, 246, 244, 0.18);
  background:
    linear-gradient(135deg, rgba(7, 13, 16, 0.9), rgba(12, 15, 18, 0.7)),
    rgba(6, 8, 9, 0.74);
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.44);
  clip-path: polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 28px 100%, 0 calc(100% - 28px));
}

.mode-panel::after,
.lobby-panel::after {
  position: absolute;
  top: 0;
  right: 34px;
  width: 112px;
  height: 3px;
  background: #ff4655;
  content: "";
}

.eyebrow {
  margin: 0 0 8px;
  color: #ff6b75;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  max-width: 760px;
  margin: 0 0 22px;
  color: #f6f1e8;
  font-size: clamp(34px, 6vw, 72px);
  line-height: 0.96;
  letter-spacing: 0;
  text-transform: uppercase;
  text-shadow: 0 10px 36px rgba(0, 0, 0, 0.48);
}

.mode-grid,
.teams {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.ai-card,
.host-card,
.join-card,
.team-column,
.code-box {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(236, 247, 244, 0.2);
  border-radius: 2px;
  background:
    linear-gradient(180deg, rgba(18, 26, 29, 0.9), rgba(8, 11, 13, 0.92)),
    rgba(8, 13, 13, 0.88);
  clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%);
}

.ai-card,
.host-card,
.join-card {
  min-height: 246px;
  padding: 18px;
}

.ai-card strong,
.host-card strong,
.join-card strong {
  display: block;
  margin-bottom: 14px;
  color: #f6f1e8;
  font-size: 20px;
  line-height: 1.05;
  text-transform: uppercase;
}

.ai-card::before,
.host-card::before,
.join-card::before,
.team-column::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: #ff4655;
  content: "";
}

.host-card::before {
  background: #f2c14e;
}

.join-card::before,
.team-column::before {
  background: #59d5ff;
}

.enemy::before {
  background: #ff4655;
}

.host-card,
.ai-card,
.join-card,
.lobby-tools {
  display: grid;
  gap: 12px;
}

label {
  display: grid;
  gap: 7px;
  color: #aebbb7;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

select,
input,
button {
  min-height: 44px;
  border: 1px solid rgba(236, 247, 244, 0.22);
  border-radius: 2px;
  background: rgba(5, 8, 10, 0.78);
  color: #edf8f5;
  outline: none;
}

select {
  color-scheme: dark;
  appearance: none;
  background:
    linear-gradient(45deg, transparent 50%, #ff4655 50%) calc(100% - 18px) 18px / 7px 7px no-repeat,
    linear-gradient(135deg, #ff4655 50%, transparent 50%) calc(100% - 12px) 18px / 7px 7px no-repeat,
    rgba(5, 8, 10, 0.78);
}

select,
input {
  width: 100%;
  padding: 0 38px 0 12px;
  font-weight: 800;
  text-transform: uppercase;
}

input::placeholder {
  color: rgba(237, 248, 245, 0.34);
}

select:focus,
input:focus {
  border-color: rgba(255, 70, 85, 0.86);
  box-shadow: inset 0 0 0 1px rgba(255, 70, 85, 0.44), 0 0 0 3px rgba(255, 70, 85, 0.12);
}

button {
  position: relative;
  overflow: hidden;
  padding: 0 14px;
  border-color: rgba(255, 70, 85, 0.58);
  background: linear-gradient(135deg, rgba(255, 70, 85, 0.98), rgba(167, 24, 39, 0.98));
  color: #fff8f0;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: transform 140ms ease, filter 140ms ease, border-color 140ms ease;
}

button::after {
  position: absolute;
  inset: auto 10px 6px auto;
  width: 28px;
  height: 2px;
  background: rgba(255, 255, 255, 0.64);
  content: "";
}

button:hover {
  filter: brightness(1.09);
  transform: translateY(-1px);
}

button:active {
  transform: translateY(0);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.lobby-header,
.lobby-tools,
.lobby-footer,
.server-panel,
.team-column header,
.team-column li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.server-panel,
.available-panel {
  margin-top: 14px;
  border: 1px solid rgba(236, 247, 244, 0.16);
  border-radius: 2px;
  background: rgba(6, 9, 11, 0.78);
}

.server-panel {
  padding: 12px;
}

.server-panel strong,
.server-panel span,
.join-url {
  display: block;
}

.server-panel span,
.join-url {
  color: #aebbb7;
  font-size: 12px;
}

.available-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
}

.available-panel button {
  display: grid;
  grid-template-columns: 1fr 76px minmax(120px, 1.3fr) 58px;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-color: rgba(89, 213, 255, 0.32);
  background: rgba(8, 13, 16, 0.82);
  text-align: left;
}

.available-panel span {
  color: #59d5ff;
  font-weight: 900;
}

.available-panel small {
  overflow: hidden;
  color: #aebbb7;
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.available-panel em {
  color: #aebbb7;
  font-style: normal;
  text-align: right;
}

.network-error {
  margin: 12px 0 0;
  color: #ffad85;
  font-size: 13px;
  font-weight: 800;
}

.lobby-header {
  margin-bottom: 14px;
}

.lobby-header h1 {
  margin-bottom: 0;
}

.map-name {
  display: inline-block;
  margin-top: 6px;
  color: #aebbb7;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.code-box {
  min-width: 136px;
  padding: 12px;
  border-color: rgba(255, 70, 85, 0.42);
  text-align: right;
}

.code-box span,
.team-column em,
.lobby-footer span {
  color: #aebbb7;
  font-size: 12px;
  font-style: normal;
}

.code-box strong {
  display: block;
  margin-top: 4px;
  color: #ff6b75;
  font-family: "Segoe UI Mono", Consolas, monospace;
  font-size: 24px;
  letter-spacing: 0.08em;
}

.lobby-tools {
  grid-template-columns: minmax(140px, 190px) 1fr auto;
  margin-bottom: 14px;
}

.team-column {
  padding: 14px;
}

.team-column header {
  margin-bottom: 10px;
}

.team-column header span {
  color: #59d5ff;
  font-weight: 900;
}

.team-column.enemy header span {
  color: #ff6b75;
}

ul {
  display: grid;
  gap: 8px;
  min-height: 238px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}

li {
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid rgba(236, 247, 244, 0.12);
  border-radius: 2px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.025));
}

.empty-slot {
  color: #75817e;
  border-style: dashed;
}

.lobby-footer {
  margin-top: 14px;
}

.start-button {
  min-width: 156px;
  border-color: rgba(89, 213, 255, 0.75);
  background: linear-gradient(135deg, rgba(89, 213, 255, 0.94), rgba(16, 76, 108, 0.98));
  color: #f5fffc;
  font-weight: 900;
}

@media (max-width: 900px) {
  .mode-grid,
  .teams,
  .lobby-tools {
    grid-template-columns: 1fr;
  }

  .lobby-header,
  .lobby-footer {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (max-width: 560px) {
  .preload-shell {
    padding: 14px;
  }

  .mode-panel,
  .lobby-panel {
    padding: 16px;
    clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
  }

  .ai-card,
  .host-card,
  .join-card {
    min-height: 0;
  }
}
</style>
