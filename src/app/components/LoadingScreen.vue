<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useGameState } from '../../game/state/useGameState';

const store = useGameState();
let timeoutId: number | undefined;

onMounted(() => {
  timeoutId = window.setTimeout(() => {
    store.enterPlaying();
  }, 1200);
});

onBeforeUnmount(() => {
  if (timeoutId) {
    window.clearTimeout(timeoutId);
  }
});
</script>

<template>
  <section class="loading-screen" aria-label="Loading match">
    <div>
      <span>Loading</span>
      <strong>{{ store.lobby.teamSize }}v{{ store.lobby.teamSize }}</strong>
      <i />
    </div>
  </section>
</template>

<style scoped>
.loading-screen {
  position: absolute;
  inset: 0;
  z-index: 13;
  display: grid;
  place-items: center;
  background:
    linear-gradient(90deg, rgba(4, 8, 10, 0.88), rgba(39, 8, 13, 0.76)),
    linear-gradient(180deg, rgba(255, 70, 85, 0.16), rgba(5, 7, 7, 0.94)),
    url('/assets/beng_beng_bg.png') center / cover no-repeat,
    #070909;
  color: #edf8f5;
}

.loading-screen div {
  position: relative;
  width: min(430px, calc(100vw - 48px));
  padding: 24px;
  border: 1px solid rgba(236, 247, 244, 0.18);
  background: rgba(7, 11, 13, 0.78);
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.42);
  clip-path: polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px));
}

.loading-screen div::before {
  position: absolute;
  top: 0;
  right: 28px;
  width: 96px;
  height: 3px;
  background: #ff4655;
  content: "";
}

span {
  display: block;
  color: #ff6b75;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

strong {
  display: block;
  margin: 8px 0 16px;
  color: #f6f1e8;
  font-size: 54px;
  line-height: 1;
  letter-spacing: 0;
  text-transform: uppercase;
}

i {
  position: relative;
  display: block;
  overflow: hidden;
  height: 10px;
  border: 1px solid rgba(236, 247, 244, 0.2);
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.28);
}

i::after {
  position: absolute;
  inset: 0;
  width: 42%;
  background: linear-gradient(90deg, #ff4655, #ffd166, #59d5ff);
  content: "";
  animation: load 1.1s ease-in-out infinite;
}

@keyframes load {
  from {
    transform: translateX(-105%);
  }

  to {
    transform: translateX(245%);
  }
}
</style>
