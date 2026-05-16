<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useGameState } from '../../game/state/useGameState';
import type { InputSnapshot, WeaponSlot } from '../../game/types/game';

type MobileInputDetail = Partial<Omit<InputSnapshot, 'mouseDeltaX' | 'mouseDeltaY'>> & {
  mouseDeltaX?: number;
  mouseDeltaY?: number;
};

const store = useGameState();
const { isBuyMenuOpen, localPlayer, phase } = storeToRefs(store);
const lookPointerId = ref<number | null>(null);
const lastLookPoint = ref({ x: 0, y: 0 });

const isVisible = computed(() => phase.value === 'playing' && !isBuyMenuOpen.value);

const sendInput = (detail: MobileInputDetail): void => {
  window.dispatchEvent(new CustomEvent<MobileInputDetail>('beng-beng-mobile-input', { detail }));
};

const setMove = (key: 'forward' | 'backward' | 'left' | 'right', value: boolean): void => {
  sendInput({ [key]: value });
};

const setFire = (value: boolean): void => {
  sendInput({ fire: value });
};

const pulse = (key: keyof Omit<InputSnapshot, 'mouseDeltaX' | 'mouseDeltaY'>): void => {
  sendInput({ [key]: true });
  window.setTimeout(() => sendInput({ [key]: false }), 70);
};

const switchSlot = (slot: WeaponSlot): void => {
  if (slot === 'primary') {
    pulse('switchPrimary');
  } else if (slot === 'secondary') {
    pulse('switchSecondary');
  } else {
    pulse('switchKnife');
  }
};

const startLook = (event: PointerEvent): void => {
  lookPointerId.value = event.pointerId;
  lastLookPoint.value = { x: event.clientX, y: event.clientY };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};

const moveLook = (event: PointerEvent): void => {
  if (lookPointerId.value !== event.pointerId) {
    return;
  }

  sendInput({
    mouseDeltaX: (event.clientX - lastLookPoint.value.x) * 1.8,
    mouseDeltaY: (event.clientY - lastLookPoint.value.y) * 1.8,
  });
  lastLookPoint.value = { x: event.clientX, y: event.clientY };
};

const endLook = (event: PointerEvent): void => {
  if (lookPointerId.value === event.pointerId) {
    lookPointerId.value = null;
  }
};
</script>

<template>
  <section v-if="isVisible" class="mobile-controls" aria-label="Mobile combat controls">
    <div class="move-pad">
      <button
        type="button"
        class="move up"
        @pointerdown.prevent="setMove('forward', true)"
        @pointerup.prevent="setMove('forward', false)"
        @pointercancel.prevent="setMove('forward', false)"
        @pointerleave.prevent="setMove('forward', false)"
      >
        W
      </button>
      <button
        type="button"
        class="move left"
        @pointerdown.prevent="setMove('left', true)"
        @pointerup.prevent="setMove('left', false)"
        @pointercancel.prevent="setMove('left', false)"
        @pointerleave.prevent="setMove('left', false)"
      >
        A
      </button>
      <button
        type="button"
        class="move down"
        @pointerdown.prevent="setMove('backward', true)"
        @pointerup.prevent="setMove('backward', false)"
        @pointercancel.prevent="setMove('backward', false)"
        @pointerleave.prevent="setMove('backward', false)"
      >
        S
      </button>
      <button
        type="button"
        class="move right"
        @pointerdown.prevent="setMove('right', true)"
        @pointerup.prevent="setMove('right', false)"
        @pointercancel.prevent="setMove('right', false)"
        @pointerleave.prevent="setMove('right', false)"
      >
        D
      </button>
    </div>

    <div
      class="look-zone"
      @pointerdown.prevent="startLook"
      @pointermove.prevent="moveLook"
      @pointerup.prevent="endLook"
      @pointercancel.prevent="endLook"
    />

    <div class="action-cluster">
      <button type="button" class="fire" @pointerdown.prevent="setFire(true)" @pointerup.prevent="setFire(false)" @pointercancel.prevent="setFire(false)">
        FIRE
      </button>
      <button type="button" @click="pulse('reload')">RLD</button>
      <button type="button" @click="store.toggleBuyMenu()">BUY</button>
      <button type="button" @pointerdown.prevent="sendInput({ jump: true })" @pointerup.prevent="sendInput({ jump: false })" @pointercancel.prevent="sendInput({ jump: false })">
        JMP
      </button>
      <button type="button" @pointerdown.prevent="sendInput({ crouch: true })" @pointerup.prevent="sendInput({ crouch: false })" @pointercancel.prevent="sendInput({ crouch: false })">
        DCK
      </button>
    </div>

    <div class="mobile-slots">
      <button type="button" :data-active="localPlayer.weaponSlot === 'primary'" :data-owned="localPlayer.inventory.primary.owned" @click="switchSlot('primary')">1</button>
      <button type="button" :data-active="localPlayer.weaponSlot === 'secondary'" :data-owned="localPlayer.inventory.secondary.owned" @click="switchSlot('secondary')">2</button>
      <button type="button" :data-active="localPlayer.weaponSlot === 'knife'" data-owned="true" @click="switchSlot('knife')">3</button>
    </div>
  </section>
</template>

<style scoped>
.mobile-controls {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: none;
  pointer-events: none;
  touch-action: none;
}

button {
  border: 1px solid rgba(210, 222, 214, 0.34);
  border-radius: 2px;
  background: rgba(14, 20, 18, 0.62);
  color: #edf5ea;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.05em;
  pointer-events: auto;
  touch-action: none;
}

button:active,
button[data-active="true"] {
  border-color: rgba(255, 210, 122, 0.86);
  background: rgba(116, 101, 54, 0.72);
}

button[data-owned="false"] {
  opacity: 0.42;
}

.move-pad {
  position: absolute;
  bottom: 22px;
  left: 18px;
  display: grid;
  grid-template-areas:
    ". up ."
    "left down right";
  grid-template-columns: repeat(3, 48px);
  gap: 7px;
  pointer-events: auto;
}

.move {
  width: 48px;
  aspect-ratio: 1;
}

.up {
  grid-area: up;
}

.left {
  grid-area: left;
}

.down {
  grid-area: down;
}

.right {
  grid-area: right;
}

.look-zone {
  position: absolute;
  inset: 80px 116px 118px 46%;
  pointer-events: auto;
  touch-action: none;
}

.action-cluster {
  position: absolute;
  right: 16px;
  bottom: 26px;
  display: grid;
  grid-template-columns: 58px 58px;
  gap: 8px;
  pointer-events: auto;
}

.action-cluster button {
  min-height: 48px;
}

.action-cluster .fire {
  grid-row: span 3;
  min-height: 160px;
  border-color: rgba(197, 80, 69, 0.78);
  background: rgba(118, 34, 31, 0.72);
}

.mobile-slots {
  position: absolute;
  right: 16px;
  bottom: 140px;
  display: grid;
  gap: 7px;
  pointer-events: auto;
}

.mobile-slots button {
  width: 42px;
  aspect-ratio: 1;
}

@media (hover: none), (pointer: coarse), (max-width: 820px) {
  .mobile-controls {
    display: block;
  }
}

@media (max-width: 760px) {
  .look-zone {
    inset: 74px 104px 108px 40%;
  }
}
</style>
