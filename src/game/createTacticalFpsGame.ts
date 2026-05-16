import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import type { GameBridge } from './state/GameBridge';

export interface TacticalFpsGameOptions {
  parent: HTMLElement;
  threeHost: HTMLElement;
  lockTarget: HTMLElement;
  bridge: GameBridge;
}

export const createTacticalFpsGame = ({
  parent,
  threeHost,
  lockTarget,
  bridge,
}: TacticalFpsGameOptions): Phaser.Game => {
  const scene = new MainScene({ bridge, threeHost, lockTarget });

  return new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: 'rgba(0,0,0,0)',
    transparent: true,
    scene,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
    },
  });
};
