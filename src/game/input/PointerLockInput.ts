import type { Disposable, InputSnapshot, KeyBindings } from '../types/game';

type MobileInputDetail = Partial<Omit<InputSnapshot, 'mouseDeltaX' | 'mouseDeltaY'>> & {
  mouseDeltaX?: number;
  mouseDeltaY?: number;
};

const emptyInput = (): InputSnapshot => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  crouch: false,
  zoomCrosshair: false,
  fire: false,
  reload: false,
  buyPrimary: false,
  buySecondary: false,
  buyGrenade: false,
  buyKevlar: false,
  switchPrimary: false,
  switchSecondary: false,
  switchKnife: false,
  quickSwitch: false,
  addPrimaryAmmo: false,
  addSecondaryAmmo: false,
  mouseDeltaX: 0,
  mouseDeltaY: 0,
});

export class PointerLockInput implements Disposable {
  private readonly pressed = new Set<string>();
  private snapshot = emptyInput();
  private mobileInput = emptyInput();
  private isZoomToggled = false;

  constructor(
    private readonly lockTarget: HTMLElement,
    private readonly onPointerLockChange: (locked: boolean) => void,
    private readonly getKeyBindings: () => KeyBindings,
  ) {
    this.lockTarget.addEventListener('click', this.requestLock);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('contextmenu', this.preventContextMenu);
    window.addEventListener('beng-beng-mobile-input', this.handleMobileInput as EventListener);
  }

  consumeFrameInput(): InputSnapshot {
    this.syncKeys();
    const frame = {
      forward: this.snapshot.forward || this.mobileInput.forward,
      backward: this.snapshot.backward || this.mobileInput.backward,
      left: this.snapshot.left || this.mobileInput.left,
      right: this.snapshot.right || this.mobileInput.right,
      jump: this.snapshot.jump || this.mobileInput.jump,
      crouch: this.snapshot.crouch || this.mobileInput.crouch,
      zoomCrosshair: this.snapshot.zoomCrosshair || this.mobileInput.zoomCrosshair,
      fire: this.snapshot.fire || this.mobileInput.fire,
      reload: this.snapshot.reload || this.mobileInput.reload,
      buyPrimary: this.snapshot.buyPrimary || this.mobileInput.buyPrimary,
      buySecondary: this.snapshot.buySecondary || this.mobileInput.buySecondary,
      buyGrenade: this.snapshot.buyGrenade || this.mobileInput.buyGrenade,
      buyKevlar: this.snapshot.buyKevlar || this.mobileInput.buyKevlar,
      switchPrimary: this.snapshot.switchPrimary || this.mobileInput.switchPrimary,
      switchSecondary: this.snapshot.switchSecondary || this.mobileInput.switchSecondary,
      switchKnife: this.snapshot.switchKnife || this.mobileInput.switchKnife,
      quickSwitch: this.snapshot.quickSwitch || this.mobileInput.quickSwitch,
      addPrimaryAmmo: this.snapshot.addPrimaryAmmo || this.mobileInput.addPrimaryAmmo,
      addSecondaryAmmo: this.snapshot.addSecondaryAmmo || this.mobileInput.addSecondaryAmmo,
      mouseDeltaX: this.snapshot.mouseDeltaX + this.mobileInput.mouseDeltaX,
      mouseDeltaY: this.snapshot.mouseDeltaY + this.mobileInput.mouseDeltaY,
    };
    this.snapshot.mouseDeltaX = 0;
    this.snapshot.mouseDeltaY = 0;
    this.mobileInput.mouseDeltaX = 0;
    this.mobileInput.mouseDeltaY = 0;
    this.snapshot.reload = false;
    this.snapshot.buyPrimary = false;
    this.snapshot.buySecondary = false;
    this.snapshot.buyGrenade = false;
    this.snapshot.buyKevlar = false;
    this.snapshot.switchPrimary = false;
    this.snapshot.switchSecondary = false;
    this.snapshot.switchKnife = false;
    this.snapshot.quickSwitch = false;
    this.snapshot.addPrimaryAmmo = false;
    this.snapshot.addSecondaryAmmo = false;
    return frame;
  }

  dispose(): void {
    this.lockTarget.removeEventListener('click', this.requestLock);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('contextmenu', this.preventContextMenu);
    window.removeEventListener('beng-beng-mobile-input', this.handleMobileInput as EventListener);
  }

  private readonly requestLock = (): void => {
    this.lockTarget.requestPointerLock();
  };

  private readonly handlePointerLockChange = (): void => {
    const isLocked = document.pointerLockElement === this.lockTarget;
    if (!isLocked) {
      this.pressed.clear();
      this.isZoomToggled = false;
      this.snapshot = emptyInput();
      this.mobileInput = emptyInput();
    }

    this.onPointerLockChange(isLocked);
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.lockTarget) {
      return;
    }

    this.snapshot.mouseDeltaX += event.movementX;
    this.snapshot.mouseDeltaY += event.movementY;
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }

    this.pressed.add(event.code);
    this.syncKeys();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
    this.syncKeys();
  };

  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.snapshot.fire = true;
    }

    if (event.button === 2) {
      this.isZoomToggled = !this.isZoomToggled;
      this.syncKeys();
    }
  };

  private readonly handleMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.snapshot.fire = false;
    }

  };

  private readonly preventContextMenu = (event: MouseEvent): void => {
    if (event.target instanceof Node && this.lockTarget.contains(event.target)) {
      event.preventDefault();
    }
  };

  private readonly handleMobileInput = (event: CustomEvent<MobileInputDetail>): void => {
    const detail = event.detail;
    Object.entries(detail).forEach(([key, value]) => {
      if (key === 'mouseDeltaX' || key === 'mouseDeltaY') {
        return;
      }

      if (key in this.mobileInput && typeof value === 'boolean') {
        this.mobileInput[key as keyof Omit<InputSnapshot, 'mouseDeltaX' | 'mouseDeltaY'>] = value;
      }
    });
    this.mobileInput.mouseDeltaX += detail.mouseDeltaX ?? 0;
    this.mobileInput.mouseDeltaY += detail.mouseDeltaY ?? 0;
  };

  private syncKeys(): void {
    const bindings = this.getKeyBindings();

    this.snapshot.forward = this.pressed.has('KeyW');
    this.snapshot.backward = this.pressed.has('KeyS');
    this.snapshot.left = this.pressed.has('KeyA');
    this.snapshot.right = this.pressed.has('KeyD');
    this.snapshot.jump = this.pressed.has(bindings.jump);
    this.snapshot.crouch = this.pressed.has(bindings.duck);
    this.snapshot.zoomCrosshair = this.pressed.has(bindings.zoomCrosshair) || this.isZoomToggled;
    this.snapshot.reload = this.pressed.has(bindings.reload);
    this.snapshot.buyPrimary = this.pressed.has(bindings.buyPrimary);
    this.snapshot.buySecondary = this.pressed.has(bindings.buySecondary);
    this.snapshot.buyGrenade = this.pressed.has(bindings.buyGrenade);
    this.snapshot.buyKevlar = this.pressed.has(bindings.buyKevlar);
    this.snapshot.switchPrimary = this.pressed.has('Digit1');
    this.snapshot.switchSecondary = this.pressed.has('Digit2');
    this.snapshot.switchKnife = this.pressed.has('Digit3');
    this.snapshot.quickSwitch = this.pressed.has('KeyQ');
    this.snapshot.addPrimaryAmmo = this.pressed.has('F2');
    this.snapshot.addSecondaryAmmo = this.pressed.has('F3');
  }
}
