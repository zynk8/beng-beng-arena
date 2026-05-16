<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { storeToRefs } from 'pinia';
import type { KeyBindings } from '../../game/types/game';
import { useGameState } from '../../game/state/useGameState';

interface BindRow {
  action: keyof KeyBindings;
  label: string;
}

const rows: BindRow[] = [
  { action: 'jump', label: 'Jump' },
  { action: 'duck', label: 'Duck' },
  { action: 'zoomCrosshair', label: 'Zoom Crosshair' },
  { action: 'reload', label: 'Reload' },
  { action: 'buyPrimary', label: 'Buy 1st Gun' },
  { action: 'buySecondary', label: 'Buy Secondary' },
  { action: 'buyGrenade', label: 'Buy Grenade' },
  { action: 'buyKevlar', label: 'Buy Kevlar' },
];

const store = useGameState();
const { keyBindings } = storeToRefs(store);
const open = ref(false);
const listeningFor = ref<keyof KeyBindings | null>(null);

const panelTitle = computed(() => (listeningFor.value ? 'Press a key' : 'Settings'));

const labelForCode = (code: string): string =>
  code
    .replace('Key', '')
    .replace('Digit', '')
    .replace('ControlLeft', 'L Ctrl')
    .replace('ShiftLeft', 'L Shift')
    .replace('Space', 'Space');

const startListening = (action: keyof KeyBindings): void => {
  document.exitPointerLock();
  document.removeEventListener('keydown', captureKey, { capture: true });
  listeningFor.value = action;
  document.addEventListener('keydown', captureKey, { capture: true });
};

const captureKey = (event: KeyboardEvent): void => {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  document.removeEventListener('keydown', captureKey, { capture: true });

  if (event.code === 'Escape') {
    listeningFor.value = null;
    return;
  }

  if (listeningFor.value) {
    store.setKeyBinding(listeningFor.value, event.code);
  }

  listeningFor.value = null;
};

onBeforeUnmount(() => {
  document.removeEventListener('keydown', captureKey, { capture: true });
});
</script>

<template>
  <section class="settings" :data-open="open" @click.stop @mousedown.stop>
    <button class="settings-toggle" type="button" @click="open = !open">
      SET
    </button>

    <div v-if="open" class="settings-panel">
      <header>
        <strong>{{ panelTitle }}</strong>
        <button type="button" @click="open = false">X</button>
      </header>

      <div class="bind-list">
        <button
          v-for="row in rows"
          :key="row.action"
          class="bind-row"
          type="button"
          :data-listening="listeningFor === row.action"
          @click="startListening(row.action)"
        >
          <span>{{ row.label }}</span>
          <strong>{{ listeningFor === row.action ? 'Press key' : labelForCode(keyBindings[row.action]) }}</strong>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 6;
  pointer-events: auto;
}

.settings-toggle,
header button {
  display: grid;
  place-items: center;
  width: 38px;
  aspect-ratio: 1;
  border: 1px solid rgba(236, 247, 244, 0.26);
  border-radius: 4px;
  background: rgba(9, 13, 13, 0.72);
  color: #edf8f5;
  cursor: pointer;
}

.settings-panel {
  position: absolute;
  top: 48px;
  right: 0;
  width: min(330px, calc(100vw - 28px));
  padding: 12px;
  border: 1px solid rgba(236, 247, 244, 0.18);
  border-radius: 6px;
  background: rgba(8, 13, 13, 0.9);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.34);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

header strong {
  font-size: 13px;
  letter-spacing: 0;
  text-transform: uppercase;
}

.bind-list {
  display: grid;
  gap: 8px;
}

.bind-row {
  display: grid;
  grid-template-columns: 1fr minmax(76px, auto);
  align-items: center;
  min-height: 38px;
  gap: 10px;
  padding: 0 10px;
  border: 1px solid rgba(236, 247, 244, 0.12);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  color: #edf8f5;
  text-align: left;
  cursor: pointer;
}

.bind-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bind-row strong {
  justify-self: end;
  color: #9bf7e8;
  font-size: 12px;
}

.bind-row[data-listening="true"] {
  border-color: rgba(155, 247, 232, 0.82);
}
</style>
