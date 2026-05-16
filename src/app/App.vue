<script setup lang="ts">
import BuyMenu from './components/BuyMenu.vue';
import GameContainer from './components/GameContainer.vue';
import GameOverModal from './components/GameOverModal.vue';
import LoadingScreen from './components/LoadingScreen.vue';
import MobileControls from './components/MobileControls.vue';
import MultiplayerSync from './components/MultiplayerSync.vue';
import PreloadLobby from './components/PreloadLobby.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import TacticalHud from './components/TacticalHud.vue';
import { useGameState } from '../game/state/useGameState';

const store = useGameState();
</script>

<template>
  <main class="app-shell">
    <GameContainer />
    <PreloadLobby />
    <LoadingScreen v-if="store.phase === 'loading'" />
    <template v-if="store.phase === 'playing'">
      <MultiplayerSync />
      <TacticalHud />
      <MobileControls />
      <SettingsPanel />
      <BuyMenu />
      <GameOverModal />
    </template>
  </main>
</template>
