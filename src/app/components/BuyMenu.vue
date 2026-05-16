<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { weaponCatalog, weaponsByCategory } from '../../game/domain/weapons';
import type { WeaponCategory, WeaponId } from '../../game/types/game';
import { useGameState } from '../../game/state/useGameState';

type BuyCategory = Exclude<WeaponCategory, 'knife'>;

const categoryKeys: Record<string, BuyCategory> = {
  Digit1: 'pistol',
  Digit3: 'rifle',
  Digit4: 'grenade',
};

const categoryLabels: Record<BuyCategory, string> = {
  pistol: 'Pistols',
  rifle: 'Rifles',
  grenade: 'Grenades',
};

const store = useGameState();
const { isBuyMenuOpen, localPlayer } = storeToRefs(store);
const selectedCategory = ref<BuyCategory>('pistol');
const isChoosingWeapon = ref(false);

const visibleWeapons = computed(() => weaponsByCategory[selectedCategory.value]);

const buyWeapon = (weaponId: WeaponId): void => {
  store.buyWeapon(weaponId);
  store.setBuyMenuOpen(false);
};

const handleKeyDown = (event: KeyboardEvent): void => {
  if (event.code === 'F1') {
    event.preventDefault();
    store.toggleBuyMenu();
    isChoosingWeapon.value = false;
    return;
  }

  if (!isBuyMenuOpen.value) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (event.code === 'Escape') {
    store.setBuyMenuOpen(false);
    return;
  }

  const category = categoryKeys[event.code];
  if (category && !isChoosingWeapon.value) {
    selectedCategory.value = category;
    isChoosingWeapon.value = true;
    return;
  }

  const match = event.code.match(/^Digit([1-9])$/);
  if (!match) {
    return;
  }

  const index = Number(match[1]) - 1;
  const weaponId = visibleWeapons.value[index];
  if (weaponId) {
    buyWeapon(weaponId);
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown, { capture: true });
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown, { capture: true });
});
</script>

<template>
  <section v-if="isBuyMenuOpen" class="buy-menu" @mousedown.stop @click.stop>
    <div class="buy-panel">
      <header>
        <strong>Buy Menu</strong>
        <button type="button" @click="store.setBuyMenuOpen(false)">X</button>
      </header>

      <nav>
        <button
          v-for="(label, category) in categoryLabels"
          :key="category"
          type="button"
          :data-active="selectedCategory === category"
          @click="selectedCategory = category; isChoosingWeapon = true"
        >
          {{ category === 'pistol' ? '1' : category === 'rifle' ? '3' : '4' }} {{ label }}
        </button>
      </nav>

      <div class="weapon-list">
        <button
          v-for="(weaponId, index) in visibleWeapons"
          :key="weaponId"
          type="button"
          class="weapon-row"
          @click="buyWeapon(weaponId)"
        >
          <span>{{ index + 1 }}</span>
          <img
            v-if="weaponCatalog[weaponId].imagePath"
            :src="weaponCatalog[weaponId].imagePath"
            :alt="weaponCatalog[weaponId].name"
          >
          <i v-else aria-hidden="true">{{ weaponCatalog[weaponId].name.slice(0, 2).toUpperCase() }}</i>
          <strong>{{ weaponCatalog[weaponId].name }}</strong>
          <em v-if="weaponCatalog[weaponId].category !== 'grenade'">
            {{ weaponCatalog[weaponId].magazineSize }} / {{ weaponCatalog[weaponId].reserveAmmo }}
          </em>
          <em v-else>Carry {{ localPlayer.grenades }}/4</em>
        </button>
      </div>

      <footer>
        <span>F1 closes</span>
        <span>Pick category, then number to buy</span>
        <span>1/2/3 switch in-game</span>
        <span>F2/F3 ammo</span>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.buy-menu {
  position: absolute;
  inset: 0;
  z-index: 7;
  display: grid;
  place-items: center;
  background:
    linear-gradient(90deg, rgba(5, 8, 10, 0.76), rgba(50, 8, 14, 0.48)),
    rgba(3, 6, 6, 0.52);
  pointer-events: auto;
}

.buy-panel {
  width: min(720px, calc(100vw - 32px));
  padding: 18px;
  border: 1px solid rgba(236, 247, 244, 0.2);
  border-radius: 2px;
  background: linear-gradient(135deg, rgba(8, 13, 16, 0.96), rgba(14, 10, 12, 0.92));
  box-shadow: 0 22px 70px rgba(0, 0, 0, 0.42);
  clip-path: polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px));
}

header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

header {
  margin-bottom: 12px;
}

header strong {
  color: #f6f1e8;
  font-size: 18px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

header button {
  width: 34px;
  aspect-ratio: 1;
  border: 1px solid rgba(255, 70, 85, 0.58);
  border-radius: 2px;
  background: rgba(255, 70, 85, 0.16);
  color: #edf8f5;
  cursor: pointer;
}

nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

nav button,
.weapon-row {
  min-height: 42px;
  border: 1px solid rgba(236, 247, 244, 0.14);
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.045);
  color: #edf8f5;
  cursor: pointer;
}

nav button[data-active="true"] {
  border-color: rgba(255, 70, 85, 0.72);
  background: linear-gradient(135deg, rgba(255, 70, 85, 0.22), rgba(89, 213, 255, 0.08));
}

.weapon-list {
  display: grid;
  gap: 8px;
}

.weapon-row {
  display: grid;
  grid-template-columns: 34px minmax(118px, 168px) 1fr minmax(86px, auto);
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  text-align: left;
  transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
}

.weapon-row span {
  color: #59d5ff;
  font-weight: 900;
}

.weapon-row:hover {
  border-color: rgba(89, 213, 255, 0.48);
  background: rgba(89, 213, 255, 0.08);
  transform: translateX(3px);
}

.weapon-row img,
.weapon-row i {
  width: 100%;
  height: 58px;
  border: 1px solid rgba(236, 247, 244, 0.08);
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(240, 246, 243, 0.96), rgba(197, 205, 198, 0.9));
}

.weapon-row img {
  object-fit: contain;
  padding: 4px 6px;
}

.weapon-row i {
  display: grid;
  place-items: center;
  color: rgba(237, 248, 245, 0.72);
  background: rgba(255, 255, 255, 0.05);
  font-size: 13px;
  font-style: normal;
  font-weight: 900;
  letter-spacing: 0;
}

.weapon-row strong {
  min-width: 0;
}

.weapon-row em {
  justify-self: end;
  color: #aebbb7;
  font-size: 12px;
  font-style: normal;
}

@media (max-width: 620px) {
  .weapon-row {
    grid-template-columns: 28px minmax(84px, 112px) 1fr;
  }

  .weapon-row img,
  .weapon-row i {
    height: 44px;
  }

  .weapon-row em {
    grid-column: 3;
    justify-self: start;
  }
}

footer {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 12px;
  color: #aebbb7;
  font-size: 12px;
}

footer span {
  padding: 3px 7px;
  border: 1px solid rgba(236, 247, 244, 0.1);
  background: rgba(255, 255, 255, 0.04);
}
</style>
