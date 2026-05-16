import type { ThreeWorldRenderer } from './ThreeWorldRenderer';

type RenderNodeManagerLike = {
  addNode?: (node: unknown) => void;
  addNodeConstructor?: (name: string, ctor: new (...args: unknown[]) => unknown) => void;
};

export class PhaserThreeRenderNode {
  readonly name = 'three-world-render-node';

  constructor(private readonly threeRenderer: ThreeWorldRenderer) {}

  run(): void {
    this.threeRenderer.render();
  }
}

export const registerThreeRenderNode = (phaserGame: Phaser.Game, node: PhaserThreeRenderNode): void => {
  const renderer = phaserGame.renderer as Phaser.Renderer.WebGL.WebGLRenderer & {
    renderNodes?: RenderNodeManagerLike;
  };

  renderer.renderNodes?.addNode?.(node);
};
