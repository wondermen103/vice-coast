// Input: keyboard state with per-frame "pressed" edges, mouse buttons, pointer-locked mouse
// deltas and the wheel. endFrame() clears the per-frame values.
export class Input {
    constructor(canvas) {
        this.keys = new Set();
        this.edges = new Set();
        this.mouse = {
            left: false,
            right: false,
            leftPressed: false,
            dx: 0,
            dy: 0
        };
        this.wheel = 0;
        addEventListener('keydown', (e) => {
            if (!this.keys.has(e.code)) this.edges.add(e.code);
            this.keys.add(e.code);
            if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
        });
        addEventListener('keyup', (e) => this.keys.delete(e.code));
        addEventListener('blur', () => this.keys.clear());
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.mouse.left = true;
                this.mouse.leftPressed = true;
            }
            if (e.button === 2) this.mouse.right = true;
            if (document.pointerLockElement !== canvas && this.lockAllowed) {
                try {
                    const p = canvas.requestPointerLock();
                    if (p && p.catch) p.catch(() => {});
                } catch { /* not allowed here */ }
            }
        });
        addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.left = false;
            if (e.button === 2) this.mouse.right = false;
        });
        addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === canvas) {
                this.mouse.dx += e.movementX;
                this.mouse.dy += e.movementY;
            }
        });
        addEventListener('wheel', (e) => {
            this.wheel += Math.sign(e.deltaY);
        }, {
            passive: true
        });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.lockAllowed = false;
    }
    down(code) {
        return this.keys.has(code);
    }
    pressed(code) {
        return this.edges.has(code);
    }
    endFrame() {
        this.edges.clear();
        this.mouse.dx = 0;
        this.mouse.dy = 0;
        this.mouse.leftPressed = false;
        this.wheel = 0;
    }
}

export class Events {
    constructor() {
        this.map = new Map();
    }
    on(name, fn) {
        if (!this.map.has(name)) this.map.set(name, []);
        this.map.get(name).push(fn);
    }
    emit(name, data) {
        for (const fn of this.map.get(name) || []) fn(data);
    }
}