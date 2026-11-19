// Textures: canvas-made glow sprites, neon lettering and billboards.
import * as THREE from 'three';

const cache = new Map();

function canvasTex(key, w, h, draw) {
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache.set(key, t);
    return t;
}

export function glowTexture() {
    return canvasTex('glow', 128, 128, (g, w) => {
        const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
        r.addColorStop(0, 'rgba(255,255,255,1)');
        r.addColorStop(0.18, 'rgba(255,255,255,0.75)');
        r.addColorStop(0.45, 'rgba(255,255,255,0.18)');
        r.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = r;
        g.fillRect(0, 0, w, w);
    });
}

export function smokeTexture() {
    return canvasTex('smoke', 64, 64, (g, w) => {
        const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
        r.addColorStop(0, 'rgba(255,255,255,0.9)');
        r.addColorStop(0.6, 'rgba(255,255,255,0.35)');
        r.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = r;
        g.fillRect(0, 0, w, w);
    });
}

// Neon lettering on a transparent canvas; the sign material multiplies it into HDR so it blooms.
export function neonTexture(text, color, font = 'italic 900 88px "Segoe Script", "Brush Script MT", cursive') {
    return canvasTex('neon:' + text + color, 512, 128, (g, w, h) => {
        g.font = font;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        let size = 88;
        while (g.measureText(text).width > w - 30 && size > 30) {
            size -= 4;
            g.font = font.replace('88px', size + 'px');
        }
        g.shadowColor = color;
        g.shadowBlur = 22;
        g.strokeStyle = color;
        g.lineWidth = 7;
        g.strokeText(text, w / 2, h / 2);
        g.shadowBlur = 8;
        g.fillStyle = '#fff';
        g.fillText(text, w / 2, h / 2);
    });
}

// Billboards advertise the city's own (invented) brands.
export function billboardTexture(title, sub, bg1, bg2) {
    return canvasTex('bb:' + title, 512, 256, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, bg1);
        gr.addColorStop(1, bg2);
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,0.15)';
        for (let i = 0; i < 6; i++) g.fillRect(0, i * 46, w, 8);
        g.fillStyle = '#fff';
        g.textAlign = 'center';
        g.font = '900 78px Impact, "Arial Black", sans-serif';
        g.fillText(title, w / 2, 130);
        g.font = 'bold 30px "Segoe UI", sans-serif';
        g.fillText(sub, w / 2, 190);
    });
}