// Portraits: painted head-and-shoulders cards of the cast for the dialogue box, drawn once on a canvas per speaker.
const FACES = {
    Nico: {
        role: 'YOU',
        bg: ['#ffcf6b', '#d9563a'],
        skin: '#c68a5e',
        hair: '#1b120c',
        cut: 'short',
        shirt: '#f4f1ea',
        chain: true,
        stubble: true
    },
    Lupe: {
        role: 'FIXER · TINTA TATTOO',
        bg: ['#ff8adf', '#5b1f6e'],
        skin: '#d9a07a',
        hair: '#141016',
        cut: 'long',
        streak: '#ff4fd8',
        shirt: '#1d1d24',
        ink: true,
        hoops: true
    },
    Sully: {
        role: 'MECHANIC · SPRAY & TUNE',
        bg: ['#7dffb0', '#13583d'],
        skin: '#5a3a26',
        hair: '#d8d8d0',
        cut: 'bald',
        beard: '#d8d8d0',
        shirt: '#2f8a5a',
        cap: '#e8b43a'
    },
    Marco: {
        role: 'SMUGGLER · WHEELMAN',
        bg: ['#6ad7ff', '#123d6b'],
        skin: '#b97850',
        hair: '#20140c',
        cut: 'locs',
        shirt: '#1aa3c9',
        shades: true,
        flowers: true
    },
    Brandt: {
        role: 'PCPD CAPTAIN',
        bg: ['#9fb4ff', '#1a2740'],
        skin: '#f1c7a5',
        hair: '#9a948c',
        cut: 'short',
        shirt: '#22385e',
        cap: '#14213a',
        badge: true,
        tache: true
    },
    Aurora: {
        role: 'OWNER · AURORA LOUNGE',
        bg: ['#ffb36b', '#8a1f4f'],
        skin: '#8a5636',
        hair: '#2a1208',
        cut: 'long',
        shirt: '#ff4fa3',
        shades: true,
        hoops: true
    },
    'Dámaso': {
        role: 'BOSS · LOS TIBURONES',
        bg: ['#ff6a5a', '#3a0b12'],
        skin: '#b97850',
        hair: '#0e0a08',
        cut: 'slick',
        shirt: '#efe7d8',
        chain: true,
        shades: true,
        scar: true
    },
};
const cache = new Map();

export function roleOf(name) {
    return FACES[name] ? .role || '';
}

export function portrait(name) {
    if (cache.has(name)) return cache.get(name);
    const f = FACES[name];
    if (!f) {
        cache.set(name, null);
        return null;
    }
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d'),
        ell = (x, y, rx, ry, col) => {
            g.fillStyle = col;
            g.beginPath();
            g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
            g.fill();
        };
    const bg = g.createLinearGradient(0, 0, 0, 128);
    bg.addColorStop(0, f.bg[0]);
    bg.addColorStop(1, f.bg[1]);
    g.fillStyle = bg;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 6; i++) g.fillRect(0, 14 + i * 20, 128, 7); // sunset bands behind the head
    if (f.cut === 'long') {
        g.fillStyle = f.hair;
        g.beginPath();
        g.ellipse(64, 70, 36, 46, 0, 0, Math.PI * 2);
        g.fill();
    }
    // shoulders and shirt
    g.fillStyle = f.shirt;
    g.beginPath();
    g.moveTo(10, 128);
    g.quadraticCurveTo(14, 96, 44, 92);
    g.lineTo(84, 92);
    g.quadraticCurveTo(114, 96, 118, 128);
    g.fill();
    if (f.flowers) {
        g.fillStyle = '#ffe36b';
        for (const [x, y] of [
                [26, 112],
                [96, 108],
                [70, 122],
                [44, 124]
            ]) ell(x, y, 5, 4, '#ffe36b');
    }
    g.fillStyle = f.skin;
    g.fillRect(54, 80, 20, 16); // neck
    if (f.shirt === '#efe7d8') {
        g.fillStyle = '#c0392b';
        g.beginPath();
        g.moveTo(58, 94);
        g.lineTo(70, 94);
        g.lineTo(64, 116);
        g.fill();
    } // the suit's red shirt
    if (f.chain) {
        g.strokeStyle = '#ffd23f';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(64, 90, 13, 0.2, Math.PI - 0.2);
        g.stroke();
    }
    if (f.badge) {
        g.fillStyle = '#e8b43a';
        g.beginPath();
        g.moveTo(92, 104);
        g.lineTo(98, 110);
        g.lineTo(92, 118);
        g.lineTo(86, 110);
        g.fill();
    }
    if (f.ink) {
        g.strokeStyle = 'rgba(30,20,60,0.75)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(58, 88, 5, 0, Math.PI * 1.5);
        g.moveTo(68, 84);
        g.lineTo(72, 94);
        g.stroke();
    }
    // head
    ell(64, 60, 25, 30, f.skin);
    ell(39, 62, 5, 8, f.skin);
    ell(89, 62, 5, 8, f.skin); // ears
    if (f.hoops) {
        g.strokeStyle = '#ffd23f';
        g.lineWidth = 2.5;
        for (const x of [38, 90]) {
            g.beginPath();
            g.arc(x, 74, 4.5, 0, Math.PI * 2);
            g.stroke();
        }
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.beginPath();
    g.ellipse(74, 64, 13, 26, 0, -Math.PI / 2, Math.PI / 2);
    g.fill(); // shade on the lit-from-the-left face
    // hair
    g.fillStyle = f.hair;
    if (f.cut === 'short' || f.cut === 'long') {
        g.beginPath();
        g.ellipse(64, 40, 26, 15, 0, Math.PI, Math.PI * 2);
        g.fill();
        g.fillRect(38, 38, 52, 6);
    }
    if (f.cut === 'long') {
        g.fillRect(36, 40, 8, 40);
        g.fillRect(84, 40, 8, 40);
        if (f.streak) {
            g.fillStyle = f.streak;
            g.fillRect(52, 30, 7, 16);
            g.fillRect(36, 44, 6, 30);
        }
    }
    if (f.cut === 'slick') {
        g.beginPath();
        g.ellipse(62, 38, 27, 14, -0.15, Math.PI, Math.PI * 2);
        g.fill();
        g.fillRect(38, 36, 50, 5);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(48, 30, 26, 2);
    }
    if (f.cut === 'locs') {
        g.beginPath();
        g.ellipse(64, 40, 28, 16, 0, Math.PI, Math.PI * 2);
        g.fill();
        for (let i = 0; i < 7; i++) g.fillRect(36 + i * 9, 36, 5, 24 + (i % 3) * 8);
    }
    if (f.cap) {
        g.fillStyle = f.cap;
        g.beginPath();
        g.ellipse(64, 36, 27, 13, 0, Math.PI, Math.PI * 2);
        g.fill();
        g.fillRect(36, 34, 56, 6);
        g.fillRect(56, 36, 42, 5);
    }
    // eyes, brows, mouth
    if (f.shades) {
        g.fillStyle = '#101018';
        g.beginPath();
        g.roundRect(42, 52, 19, 10, 3);
        g.roundRect(67, 52, 19, 10, 3);
        g.fill();
        g.fillRect(60, 55, 8, 3);
        g.fillStyle = 'rgba(255,190,120,0.7)';
        g.fillRect(45, 54, 6, 2);
        g.fillRect(70, 54, 6, 2);
    } else {
        for (const x of [52, 76]) {
            ell(x, 57, 5, 3.6, '#fff');
            ell(x + 1, 57, 2.6, 3, '#2a1a10');
        }
        g.fillStyle = f.hair === '#d8d8d0' ? '#bbb' : '#1b120c';
        g.fillRect(45, 49, 14, 3);
        g.fillRect(69, 49, 14, 3);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(62, 62, 4, 10); // nose
    if (f.beard) {
        g.fillStyle = f.beard;
        g.beginPath();
        g.ellipse(64, 80, 20, 12, 0, 0, Math.PI);
        g.fill();
        g.fillRect(44, 70, 40, 10);
    }
    if (f.stubble) {
        g.fillStyle = 'rgba(30,20,10,0.28)';
        g.beginPath();
        g.ellipse(64, 78, 19, 12, 0, 0, Math.PI);
        g.fill();
    }
    if (f.tache) {
        g.fillStyle = f.hair;
        g.fillRect(54, 72, 20, 4);
    }
    g.fillStyle = '#7a2a2a';
    g.fillRect(57, 78, 14, 3); // mouth
    if (f.scar) {
        g.strokeStyle = '#7a3a2a';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(80, 46);
        g.lineTo(74, 72);
        g.stroke();
    }
    const url = c.toDataURL('image/png');
    cache.set(name, url);
    return url;
}