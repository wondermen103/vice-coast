type Listener<T = unknown> = (payload: T) => void;

export class Events {
  private map = new Map<string, Listener[]>();

  on<T = any>(name: string, fn: Listener<T>): () => void {
    const list = this.map.get(name) ?? [];
    list.push(fn as Listener);
    this.map.set(name, list);
    return () => {
      const arr = this.map.get(name);
      if (!arr) return;
      const idx = arr.indexOf(fn as Listener);
      if (idx >= 0) arr.splice(idx, 1);
    };
  }

  emit<T = any>(name: string, payload?: T): void {
    const list = this.map.get(name);
    if (!list) return;
    for (const fn of list) fn(payload);
  }
}

export class Input {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  public mouse = {
    left: false,
    right: false,
    leftPressed: false,
    dx: 0,
    dy: 0,
  };
  public wheel = 0;
  public lockAllowed = false;
  private cleanups: Array<() => void> = [];

  constructor(private canvas: HTMLCanvasElement) {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.target !== this.canvas) return;
      if (e.button === 0) {
        this.mouse.left = true;
        this.mouse.leftPressed = true;
      }
      if (e.button === 2) this.mouse.right = true;
      if (this.lockAllowed && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock?.();
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === this.canvas || this.mouse.right) {
        this.mouse.dx += e.movementX;
        this.mouse.dy += e.movementY;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.target === this.canvas) {
        this.wheel += Math.sign(e.deltaY);
      }
    };

    const onContext = (e: MouseEvent) => {
      if (e.target === this.canvas) e.preventDefault();
    };

    const clearAll = () => {
      this.keys.clear();
      this.justPressed.clear();
      this.mouse.left = false;
      this.mouse.right = false;
      this.mouse.leftPressed = false;
      this.mouse.dx = 0;
      this.mouse.dy = 0;
      this.wheel = 0;
    };

    const onVisibility = () => {
      if (document.hidden) clearAll();
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', onContext);
    window.addEventListener('blur', clearAll);
    document.addEventListener('visibilitychange', onVisibility);

    this.cleanups.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => window.removeEventListener('mousedown', onMouseDown),
      () => window.removeEventListener('mouseup', onMouseUp),
      () => window.removeEventListener('mousemove', onMouseMove),
      () => window.removeEventListener('wheel', onWheel),
      () => window.removeEventListener('contextmenu', onContext),
      () => window.removeEventListener('blur', clearAll),
      () => document.removeEventListener('visibilitychange', onVisibility),
    );
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }

  pressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  clear(): void {
    this.keys.clear();
    this.justPressed.clear();
    this.mouse.left = false;
    this.mouse.right = false;
    this.mouse.leftPressed = false;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.wheel = 0;
  }

  releaseAll(): void {
    this.clear();
  }

  endFrame(): void {
    this.justPressed.clear();
    this.mouse.leftPressed = false;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.wheel = 0;
  }

  dispose(): void {
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
  }
}
