// StoryMissions: the cast, key places and the eight-mission story of Nico Varela, as step data.
export const CAST = {
    nico: {
        name: 'Nico Varela',
        color: '#ffd166'
    },
    lupe: {
        name: 'Lupe "La Tinta" Arriaga',
        short: 'Lupe',
        color: '#ff7ad9'
    },
    sully: {
        name: 'Sully Okafor',
        short: 'Sully',
        color: '#7dffb0'
    },
    marco: {
        name: 'Marco "Tidal" Benn',
        short: 'Marco',
        color: '#6ad7ff'
    },
    brandt: {
        name: 'Capt. Hollis Brandt',
        short: 'Brandt',
        color: '#9fb4ff'
    },
    aurora: {
        name: 'Aurora Kade',
        short: 'Aurora',
        color: '#ffb36b'
    },
    damaso: {
        name: 'Dámaso "El Tiburón" Reyes',
        short: 'Dámaso',
        color: '#ff5a5a'
    },
};

export const PLACES = {
    lupe: [252, 441, 'Tinta Tattoo, Neon Row'],
    sully: [441, 324, "Sully's Spray & Tune"],
    marco: [-12, 252, 'Muelle Celeste'],
    brandt: [298, 180, 'PCPD Central'],
    aurora: [324, 366, 'Aurora Lounge'],
    safehouse: [82, 468, 'Casa Varela'],
    bank: [252, 298, 'Banco Celeste'],
    guns: [180, 370, 'Tidewater Arms'],
    clinic: [252, 82, 'Mercy Clinic'],
};

export const GANG_LOOK = {
    skin: '#b97850',
    hair: '#111',
    shirt: '#1aa3c9',
    pants: '#1d1d24',
    shoe: '#f2f2f2',
    shades: true,
    cap: '#0b6a85',
    longSleeve: false
};
export const GUARD_LOOK = {
    skin: '#d9a07a',
    hair: '#222',
    shirt: '#2b2b30',
    pants: '#2b2b30',
    shoe: '#111',
    vest: '#3a3a40',
    longSleeve: true
};
export const AURORA_LOOK = {
    skin: '#8a5636',
    hair: '#2a1208',
    shirt: '#ff4fa3',
    pants: '#ff4fa3',
    shoe: '#ffd23f',
    longHair: true,
    shades: true,
    scale: 0.97
};

export const STORY = [{
        id: 'homecoming',
        title: 'Homecoming',
        giver: 'lupe',
        reward: 800,
        intro: [
            ['lupe', 'Six years and you still walk like you own the Malecón, Nico.'],
            ['lupe', 'Your sister owes the Tiburones. Sully has work for you. Get wheels.']
        ],
        steps: [{
            t: 'car',
            text: 'Get a car: any car'
        }, {
            t: 'goto',
            at: 'sully',
            needCar: true,
            text: "Drive to Sully's Spray & Tune",
            say: [
                ['sully', 'Nico Varela! Paint still wet on the legend, eh? Come back when you want real work.']
            ]
        }]
    },
    {
        id: 'paint-it-gold',
        title: 'Paint It Gold',
        giver: 'sully',
        reward: 2200,
        unlock: 'garage',
        intro: [
            ['sully', 'A banker in Palm Heights parks an Aureo GT on the street like it is a bicycle.'],
            ['sully', 'Bring it here without a scratch and the garage is yours to use.']
        ],
        steps: [{
            t: 'steal',
            model: 'aureo',
            paint: '#e8b43a',
            pos: [300, 75.6],
            h: -Math.PI / 2,
            text: 'Steal the gold Aureo GT in Palm Heights'
        }, {
            t: 'deliver',
            at: 'sully',
            text: "Bring the Aureo to Sully's",
            say: [
                ['sully', 'Beautiful. Respray, engine, armour: my shop is open to you now.']
            ]
        }]
    },
    {
        id: 'shark-tax',
        title: 'Shark Tax',
        giver: 'lupe',
        reward: 3500,
        unlock: 'smg',
        intro: [
            ['lupe', "Dámaso's collectors squeeze every bar on Neon Row. Tonight they collect from you."]
        ],
        steps: [{
            t: 'kill',
            pos: [180, 500],
            n: 5,
            text: 'Take out the Tiburones collectors',
            say: [
                ['damaso', 'Who is this nobody shooting my boys?']
            ]
        }, {
            t: 'pickup',
            pos: [196, 506],
            text: 'Grab the collection bag'
        }, {
            t: 'escape',
            level: 2,
            text: 'Lose the PCPD'
        }]
    },
    {
        id: 'tide-runner',
        title: 'Tide Runner',
        giver: 'marco',
        reward: 3000,
        intro: [
            ['marco', 'A driver who can read the boulevard is worth more than a boat. Show me.']
        ],
        steps: [{
            t: 'car',
            text: 'Get a fast car'
        }, {
            t: 'race',
            cps: [
                [0, 160],
                [0, 40],
                [72, 0],
                [216, 0],
                [216, 144],
                [144, 216],
                [72, 288],
                [0, 360],
                [0, 480]
            ],
            time: 95,
            text: 'Race the Malecón loop'
        }]
    },
    {
        id: 'dirty-badge',
        title: 'Dirty Badge',
        giver: 'brandt',
        reward: 5000,
        intro: [
            ['brandt', "Evidence locker's open for ninety seconds. Take the box, and my men will 'chase' you."]
        ],
        steps: [{
            t: 'pickup',
            pos: [298, 184],
            text: 'Take the evidence box'
        }, {
            t: 'goto',
            at: 'marco',
            time: 100,
            wanted: 2,
            text: 'Get the box to the pier before time runs out',
            say: [
                ['marco', 'Box goes in the water, Brandt stays happy, we all stay rich.']
            ]
        }]
    },
    {
        id: 'dockside',
        title: 'Dockside Ambush',
        giver: 'marco',
        reward: 7000,
        unlock: 'shotgun',
        intro: [
            ['marco', 'The Tiburones stole my van at the Old Port. Get it back. Bring friends: bullets.']
        ],
        steps: [{
            t: 'kill',
            pos: [540, 436],
            n: 7,
            text: 'Clear the Tiburones from the docks'
        }, {
            t: 'steal',
            model: 'van',
            paint: '#3ec1d3',
            pos: [520, 428],
            h: Math.PI / 2,
            text: "Take Marco's van"
        }, {
            t: 'deliver',
            at: 'sully',
            text: "Hide the van at Sully's"
        }]
    },
    {
        id: 'neon-nights',
        title: 'Neon Nights',
        giver: 'aurora',
        reward: 9000,
        unlock: 'rifle',
        intro: [
            ['aurora', 'Dámaso wants my lounge. The PCPD wants me in a cell. I want a ride.']
        ],
        steps: [{
            t: 'car',
            text: 'Get a car'
        }, {
            t: 'companion',
            at: 'aurora',
            look: 'aurora',
            text: 'Pick up Aurora',
            say: [
                ['aurora', 'Drive, Nico. Brandt sold us out: the whole precinct is coming.']
            ]
        }, {
            t: 'escape',
            level: 3,
            text: 'Lose the PCPD with Aurora aboard'
        }, {
            t: 'goto',
            pos: [216, 228],
            needCar: true,
            text: 'Drop Aurora at the Cristal Tower',
            say: [
                ['aurora', 'Banco Celeste holds Dámaso\'s money. Golden hour, tomorrow.']
            ]
        }]
    },
    {
        id: 'golden-hour',
        title: 'Golden Hour',
        giver: 'lupe',
        reward: 25000,
        final: true,
        intro: [
            ['lupe', 'Banco Celeste. Dámaso\'s vault. Your sister\'s debt, and then some.'],
            ['lupe', 'Marco waits at the pier. Do not be late.']
        ],
        steps: [{
            t: 'kill',
            pos: [252, 304],
            n: 6,
            look: 'guard',
            text: 'Take down the vault guards'
        }, {
            t: 'pickup',
            pos: [256, 300],
            text: 'Grab the cash'
        }, {
            t: 'car',
            text: 'Get a getaway car'
        }, {
            t: 'escape',
            level: 4,
            time: 150,
            text: "Lose the manhunt before Marco's boat sails"
        }, {
            t: 'goto',
            at: 'marco',
            text: 'Reach the boat at the pier',
            say: [
                ['marco', 'Get in! Puerto Celeste is yours, Kings of the golden hour.']
            ]
        }]
    },
];

export const SIDE = {
    race: {
        title: 'Boardwalk Rush',
        start: [-4, 520],
        cps: [
            [0, 400],
            [0, 250],
            [0, 100],
            [72, 30],
            [144, 100],
            [144, 250],
            [72, 360],
            [0, 470]
        ],
        time: 70,
        reward: 1500
    },
    shells: [
        [-40, 30],
        [-55, 300],
        [144, 20],
        [432, 90],
        [504, 300],
        [300, 576],
        [4, 560],
        [-30, 470],
        [360, 250],
        [180, 216]
    ],
};