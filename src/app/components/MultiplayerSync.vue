<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { lobbyClient } from '../../game/network/lobbyClient';
import { useGameState } from '../../game/state/useGameState';

const store = useGameState();
let intervalId: number | undefined;

const sync = async (): Promise<void> => {
  if (
    store.phase !== 'playing' ||
    store.lobby.mode !== 'multiplayer' ||
    !store.lobby.localPlayerId ||
    store.lobby.lobbyCode === 'LOCAL'
  ) {
    return;
  }

  try {
    const player = store.localPlayer;
    const response = await lobbyClient.updatePlayer(
      store.lobby.lobbyCode,
      store.lobby.localPlayerId,
      player.position,
      player.yaw,
      player.pitch,
      player.health,
    );
    store.applyNetworkMatch(response.match);
  } catch {
    const response = await lobbyClient.matchState(store.lobby.lobbyCode, store.lobby.localPlayerId);
    store.applyNetworkMatch(response.match);
  }
};

onMounted(() => {
  sync();
  intervalId = window.setInterval(sync, 90);
});

onBeforeUnmount(() => {
  if (intervalId) {
    window.clearInterval(intervalId);
  }
});
</script>

<template>
  <span class="multiplayer-sync" aria-hidden="true" />
</template>
