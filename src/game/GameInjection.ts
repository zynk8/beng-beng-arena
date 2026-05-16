import type { InjectionKey, Ref } from 'vue';

export const PhaserGameKey: InjectionKey<Ref<Phaser.Game | null>> = Symbol('PhaserGame');
