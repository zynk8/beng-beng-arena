<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { createTacticalFpsGame } from '../../game/createTacticalFpsGame';
import { PhaserGameKey } from '../../game/GameInjection';
import { GameBridge } from '../../game/state/GameBridge';
import { useGameState } from '../../game/state/useGameState';

const gameHost = ref<HTMLElement | null>(null);
const phaserHost = ref<HTMLElement | null>(null);
const threeHost = ref<HTMLElement | null>(null);
const phaserGame = shallowRef<Phaser.Game | null>(null);

const store = useGameState();
const { isBuyMenuOpen, phase, selectedMapId } = storeToRefs(store);
const bridge = new GameBridge(store);
let autoLockTimeout: number | undefined;

provide(PhaserGameKey, phaserGame);

const mountGame = (): void => {
  if (!gameHost.value || !phaserHost.value || !threeHost.value) {
    return;
  }

  phaserGame.value?.destroy(true);
  phaserGame.value = createTacticalFpsGame({
    parent: phaserHost.value,
    threeHost: threeHost.value,
    lockTarget: gameHost.value,
    bridge,
  });
};

onMounted(() => {
  mountGame();

  nextTick(() => {
    autoLockTimeout = window.setTimeout(() => {
      requestAimLock();
    }, 80);
  });

  window.addEventListener('pointerdown', requestAimLockOnInput, { capture: true });
  window.addEventListener('keydown', requestAimLockOnInput, { capture: true });
});

onBeforeUnmount(() => {
  if (autoLockTimeout) {
    window.clearTimeout(autoLockTimeout);
  }

  phaserGame.value?.destroy(true);
  phaserGame.value = null;
  window.removeEventListener('pointerdown', requestAimLockOnInput, { capture: true });
  window.removeEventListener('keydown', requestAimLockOnInput, { capture: true });
});

const requestAimLock = (): void => {
  if (!gameHost.value || document.pointerLockElement === gameHost.value) {
    return;
  }

  const lockResult = gameHost.value.requestPointerLock();
  if (lockResult instanceof Promise) {
    lockResult.catch(() => undefined);
  }
};

const requestAimLockOnInput = (): void => {
  if (phase.value === 'loading' || phase.value === 'playing') {
    requestAimLock();
  }
};

watch(phase, (value) => {
  if (value !== 'loading' && value !== 'playing') {
    return;
  }

  requestAimLock();
  window.setTimeout(requestAimLock, 120);
  window.setTimeout(requestAimLock, 420);
});

watch(isBuyMenuOpen, (isOpen) => {
  if (isOpen || phase.value !== 'playing') {
    return;
  }

  window.setTimeout(requestAimLock, 80);
});

watch(selectedMapId, () => {
  if (phase.value === 'playing') {
    return;
  }

  mountGame();
});
</script>

<template>
  <section ref="gameHost" class="game-container" data-game-lock-target aria-label="Tactical FPS game viewport">
    <div ref="threeHost" class="three-layer" />
    <div ref="phaserHost" class="phaser-layer" />
  </section>
</template>

<style scoped>
.game-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  user-select: none;
}

.three-layer,
.phaser-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.three-layer {
  z-index: 0;
}

.phaser-layer {
  z-index: 1;
  pointer-events: none;
}

:deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

</style>
