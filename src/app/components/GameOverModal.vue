<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useGameState } from '../../game/state/useGameState';

const store = useGameState();
const { isGameOver, kills, score, winnerName, winnerTeam } = storeToRefs(store);
</script>

<template>
  <section v-if="isGameOver" class="game-over" @mousedown.stop @click.stop>
    <div class="game-over-panel">
      <strong>Game Over</strong>
      <b v-if="winnerName">{{ winnerName }} won</b>
      <b v-else-if="winnerTeam">{{ winnerTeam === 'friendly' ? 'Blue team' : 'Red team' }} won</b>
      <span>Kills {{ kills }} - Score {{ score }}</span>
      <button type="button" @click="store.restartMatch()">Restart</button>
    </div>
  </section>
</template>

<style scoped>
.game-over {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  background: rgba(5, 6, 6, 0.62);
  pointer-events: auto;
}

.game-over-panel {
  display: grid;
  justify-items: center;
  gap: 12px;
  width: min(360px, calc(100vw - 32px));
  padding: 24px;
  border: 1px solid rgba(255, 92, 92, 0.42);
  border-radius: 6px;
  background: rgba(8, 13, 13, 0.94);
  color: #edf8f5;
}

.game-over-panel strong {
  color: #ff7474;
  font-size: 30px;
  line-height: 1;
  text-transform: uppercase;
}

.game-over-panel b {
  color: #edf8f5;
  font-size: 18px;
  text-transform: uppercase;
}

.game-over-panel span {
  color: #aebbb7;
  font-size: 13px;
}

.game-over-panel button {
  min-width: 132px;
  min-height: 40px;
  border: 1px solid rgba(155, 247, 232, 0.68);
  border-radius: 4px;
  background: rgba(155, 247, 232, 0.1);
  color: #edf8f5;
  cursor: pointer;
}
</style>
