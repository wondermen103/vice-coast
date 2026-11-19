// StoryMissions: Vice Coast cast, landmarks, 8-mission English story arc,
// Boardwalk Rush race, and 10 Golden Shells.
import { BLOCK, PIER_Z, ROAD } from '../world/CityLayout.ts';
import type { PersonLook } from '../people/PersonModel.ts';

export interface CastMember {
  name: string;
  role: string;
  color: string;
  look: PersonLook;
}

export const CAST: Record<string, CastMember> = {
  nico: {
    name: 'Jason Vance',
    role: 'Getaway Driver',
    color: '#00f0d8',
    look: {
      skin: '#c48f6a',
      hair: '#1c1510',
      shirt: '#15b8c2',
      tee: '#f4f2ee',
      pants: '#232c44',
      shoe: '#f4f2ec',
      shades: true,
      shirtPrint: true,
      denim: true,
      bodyType: 'athletic',
    },
  },
  lucia: {
    name: 'Lucia Reyes',
    role: 'Heist Tactician',
    color: '#ff2e93',
    look: {
      skin: '#be8360',
      hair: '#160f0d',
      shirt: '#ff3c85',
      pants: '#1d2230',
      shoe: '#f4f2ec',
      luciaStyle: true,
      denim: true,
      ponytail: true,
      earrings: true,
      bodyType: 'feminine',
    },
  },
  lupe: {
    name: 'Lou Mercer',
    role: 'Pier Lounge Owner',
    color: '#ff7c5c',
    look: {
      skin: '#c48d67',
      hair: '#2a1810',
      shirt: '#ff3d8a',
      tee: '#fff4e6',
      pants: '#1d2230',
      shoe: '#f0ece1',
    },
  },
  sully: {
    name: 'Sully Park',
    role: 'Master Tuner',
    color: '#ff9b54',
    look: {
      skin: '#dcb08c',
      hair: '#181820',
      shirt: '#39557a',
      tee: '#eaeef4',
      pants: '#2d3138',
      shoe: '#262626',
    },
  },
  marco: {
    name: 'Marcus Cole',
    role: 'Neon Broker',
    color: '#ff2e93',
    look: {
      skin: '#d9a482',
      hair: '#3b281c',
      shirt: '#7a2c8a',
      tee: '#16161c',
      pants: '#171922',
      shoe: '#111',
      shades: true,
      longSleeve: true,
    },
  },
  brandt: {
    name: 'Det. Brandt',
    role: 'VCPD Internal',
    color: '#60b8ff',
    look: {
      skin: '#d8a68a',
      hair: '#696c75',
      shirt: '#324869',
      tee: '#dfe7f0',
      pants: '#1b2434',
      shoe: '#161616',
      longSleeve: true,
    },
  },
  aurora: {
    name: 'Elena Storm',
    role: 'Drift Champion',
    color: '#00f0d8',
    look: {
      skin: '#c88d68',
      hair: '#1b1116',
      shirt: '#f0c43c',
      tee: '#16161c',
      pants: '#222633',
      shoe: '#fff',
    },
  },
  damaso: {
    name: 'Damon Vance',
    role: 'Harbor Baron',
    color: '#ff4f6e',
    look: {
      skin: '#b57b58',
      hair: '#c8c6c2',
      shirt: '#f2ece1',
      tee: '#18181f',
      pants: '#e8e2d5',
      shoe: '#1a1a1a',
      longSleeve: true,
    },
  },
};

export interface PlaceDef {
  x: number;
  z: number;
  label: string;
  color: string;
  fastTravel?: boolean;
}

export const PLACES: Record<string, PlaceDef> = {
  safehouse: { x: 24, z: 3 * BLOCK + 18, label: 'Bayview Safehouse', color: '#00f0d8', fastTravel: true },
  lupeBar: { x: 16, z: PIER_Z + 12, label: "Lou's Pier Lounge", color: '#ff7c5c', fastTravel: true },
  sully: { x: 2 * BLOCK + 22, z: 2 * BLOCK + 14, label: "Sully's Custom Garage", color: '#ff9b54', fastTravel: true },
  guns: { x: 3 * BLOCK + 18, z: 4 * BLOCK + 22, label: 'Tidewater Arms', color: '#ff4f6e', fastTravel: true },
  marcoClub: { x: 3 * BLOCK + 20, z: 6 * BLOCK + 18, label: 'Club Solstice', color: '#ff2e93', fastTravel: true },
  precinct: { x: 4 * BLOCK + 24, z: 3 * BLOCK + 20, label: 'Downtown Precinct', color: '#60b8ff', fastTravel: true },
  portGate: { x: 6 * BLOCK + 18, z: 4 * BLOCK + 16, label: 'Harbor Docks Gate', color: '#ff9b54', fastTravel: true },
  villa: { x: 4 * BLOCK + 26, z: 0 * BLOCK + 24, label: 'Heights Estate', color: '#00f0d8', fastTravel: true },
  hospital: { x: 3 * BLOCK + 16, z: 2 * BLOCK + 22, label: 'Mercy Coastal Clinic', color: '#f4f1ea' },
  pierEnd: { x: -ROAD / 2 - 42, z: PIER_Z, label: 'Vice Lighthouse Pier', color: '#ffd36e', fastTravel: true },
};

export interface StoryStep {
  kind: 'go' | 'steal' | 'combat' | 'deliver' | 'race' | 'evade';
  cue: string;
  place?: string;
  x?: number;
  z?: number;
  radius?: number;
  carModel?: string;
  carPaint?: string;
  carLabel?: string;
  enemies?: number;
  wanted?: number;
  timeLimit?: number;
  line?: [string, string];
  checkpoints?: [number, number][];
}

export interface MissionDef {
  id: string;
  num: number;
  giver: keyof typeof CAST;
  giverPlace: keyof typeof PLACES;
  title: string;
  sub: string;
  pay: number;
  rep: number;
  unlocks?: string;
  intro: [string, string][];
  steps: StoryStep[];
  outro: [string, string];
}

export interface ViceGramPost {
  id: string;
  handle: string;
  location: string;
  caption: string;
  likes: string;
  tag: string;
  x: number;
  z: number;
  accent: string;
}

export const PROLOGUE_LINES: ReadonlyArray<[keyof typeof CAST, string]> = [
  ['lucia', "Parole monitor's finally off, Jason. Lou just texted — Damon's crew is already moving on Ocean Drive."],
  ['nico', "Then we hit back first. Keys are in the Viper Comet RS — let's roll down to Lou's Pier Lounge."],
];

export const VICEGRAM_POSTS: readonly ViceGramPost[] = [
  {
    id: 'vg1',
    handle: '@vicecoast.live',
    location: "Lou's Pier Lounge",
    caption: 'Sunset meetup at the pier — word is Lou has a high-payoff job for the right crew.',
    likes: '14.2K',
    tag: 'STORY',
    x: 16,
    z: PIER_Z + 12,
    accent: '#ff7c5c',
  },
  {
    id: 'vg2',
    handle: '@leonida.boost',
    location: 'Ocean Drive Ramp',
    caption: 'Someone just cleared 50 meters off the Ocean Drive launch ramp with twin-stage nitrous!',
    likes: '28.9K',
    tag: 'STUNT',
    x: 0,
    z: 324,
    accent: '#00f0d8',
  },
  {
    id: 'vg3',
    handle: '@vcpd.scanner',
    location: 'Harbor Docks',
    caption: 'Armored Syndicate Vault Van rolling along Harbor Road — heavy cash payload reported.',
    likes: '9.4K',
    tag: 'HEIST',
    x: 6 * BLOCK + 18,
    z: 4 * BLOCK + 16,
    accent: '#ff2e93',
  },
  {
    id: 'vg4',
    handle: '@sullyscustoms',
    location: "Sully's Custom Garage",
    caption: 'Fresh pearl paint jobs, underglow kits & Stage-2 Nitrous installs open all night on Breeze St.',
    likes: '6.8K',
    tag: 'GARAGE',
    x: 2 * BLOCK + 22,
    z: 2 * BLOCK + 14,
    accent: '#ff9b54',
  },
  {
    id: 'vg5',
    handle: '@neonstrip.nights',
    location: 'Club Solstice',
    caption: 'Midnight street race qualifiers firing up along the Neon Strip boardwalk.',
    likes: '19.1K',
    tag: 'RACE',
    x: 3 * BLOCK + 20,
    z: 6 * BLOCK + 18,
    accent: '#c084fc',
  },
];

export const STORY: readonly MissionDef[] = [
  {
    id: 'm1',
    num: 1,
    giver: 'lupe',
    giverPlace: 'lupeBar',
    title: 'Sunset Run',
    sub: "Collect Lou's vintage Apex GT from Palm Heights before Damon's crew tows it.",
    pay: 2200,
    rep: 90,
    intro: [
      ['lupe', "Jason, Lucia! Damon's crew tagged my Apex GT up on Palm Drive. Grab it before they strip it."],
      ['lucia', "We've got this, Lou. Stay on the scanner — we'll bring it back clean."],
    ],
    steps: [
      {
        kind: 'steal',
        cue: "Recover Lou's gold Apex GT in Palm Heights",
        x: 3 * BLOCK,
        z: 1 * BLOCK,
        carModel: 'aureo',
        carPaint: '#f5b324',
        carLabel: "Lou's Apex GT",
        wanted: 1,
      },
      {
        kind: 'deliver',
        cue: "Bring the Apex GT back to Lou's Pier Lounge",
        place: 'lupeBar',
        radius: 13,
        line: ['lupe', 'Not even a scratch on the fender. Take this envelope and go see Sully.'],
      },
    ],
    outro: ['lupe', "Sully's garage on Breeze Street is open for you two now. He'll wire up your nitrous."],
  },
  {
    id: 'm2',
    num: 2,
    giver: 'sully',
    giverPlace: 'sully',
    title: 'Turbo & Paint',
    sub: "Test-drive Sully's tuned Solaris V12 through an Ocean Drive sprint and bring it home clean.",
    pay: 3200,
    rep: 130,
    unlocks: 'sullyFull',
    intro: [
      ['sully', 'Finished the twin-turbo map on the Solaris V12. Hit the Ocean Drive checkpoints — hold Shift for nitrous!'],
      ['nico', "Let's wake up the palm trees."],
    ],
    steps: [
      {
        kind: 'race',
        cue: 'Hit all 5 Ocean Drive telemetry checkpoints in 85s',
        timeLimit: 85,
        checkpoints: [
          [2 * BLOCK, 3 * BLOCK],
          [0, 3 * BLOCK],
          [0, 5 * BLOCK],
          [1 * BLOCK, 5 * BLOCK],
          [2 * BLOCK, 2 * BLOCK],
        ],
      },
      {
        kind: 'deliver',
        cue: "Park back at Sully's Custom Garage",
        place: 'sully',
        radius: 13,
      },
    ],
    outro: ['sully', 'Telemetry looks lethal. Full Engine, Armor, and Nitrous kits are unlocked at my bay.'],
  },
  {
    id: 'm3',
    num: 3,
    giver: 'marco',
    giverPlace: 'marcoClub',
    title: 'Neon Debt',
    sub: "Clear out Damon's enforcers shaking down Club Solstice and seize their ledger.",
    pay: 4500,
    rep: 180,
    intro: [
      ['marco', "Damon parked four enforcers behind Neon Strip to choke my deliveries. Clear the alley, Jason."],
      ['nico', 'Consider the street swept.'],
    ],
    steps: [
      {
        kind: 'go',
        cue: 'Head to the Neon Strip loading alley',
        x: 4 * BLOCK,
        z: 6 * BLOCK,
        radius: 20,
      },
      {
        kind: 'combat',
        cue: "Neutralize Damon's 4 Neon Strip enforcers",
        x: 4 * BLOCK + 18,
        z: 6 * BLOCK + 16,
        enemies: 4,
        wanted: 2,
      },
      {
        kind: 'deliver',
        cue: 'Report back to Marcus at Club Solstice',
        place: 'marcoClub',
        radius: 14,
      },
    ],
    outro: ['marco', "Neon Strip breathes again. Here's your cut — plus a tip on Tidewater's backroom stock."],
  },
  {
    id: 'm4',
    num: 4,
    giver: 'aurora',
    giverPlace: 'lupeBar',
    title: 'Boardwalk Crown',
    sub: "Beat Elena's benchmark lap around Ocean Drive and Downtown Vice.",
    pay: 5500,
    rep: 220,
    intro: [
      ['aurora', "Think you've got hands for Vice Coast? Beat 95 seconds on my Ocean Drive to Downtown circuit."],
      ['nico', 'Keep the stopwatch warm.'],
    ],
    steps: [
      {
        kind: 'race',
        cue: "Finish Elena's 6-gate coastal circuit within 95s",
        timeLimit: 95,
        checkpoints: [
          [0, 2 * BLOCK],
          [2 * BLOCK, 1 * BLOCK],
          [4 * BLOCK, 2 * BLOCK],
          [4 * BLOCK, 5 * BLOCK],
          [2 * BLOCK, 6 * BLOCK],
          [0, 4 * BLOCK],
        ],
      },
    ],
    outro: ['aurora', "Clean lines, Jason. You've earned the keys to every stunt ramp on the coast."],
  },
  {
    id: 'm5',
    num: 5,
    giver: 'brandt',
    giverPlace: 'precinct',
    title: 'Pier Contraband',
    sub: "Intercept Damon's armored cash convoy near Harbor Docks and lose the VCPD.",
    pay: 7200,
    rep: 270,
    intro: [
      ['brandt', "Damon's moving dirty harbor manifests in an Armored Cash Van at Harbor Docks. Steal it and vanish."],
      ['nico', "And VCPD won't get the memo?"],
      ['brandt', "Oh, they'll definitely chase you. Lose them before dropping it at Sully's."],
    ],
    steps: [
      {
        kind: 'steal',
        cue: 'Hijack the Armored Cash Van at Harbor Docks',
        x: 6 * BLOCK,
        z: 4 * BLOCK,
        carModel: 'cashvan',
        carPaint: '#1c2834',
        carLabel: 'Armored Cash Van',
        wanted: 3,
      },
      {
        kind: 'evade',
        cue: "Shake the 3-Star VCPD pursuit (or respray at Sully's)",
      },
      {
        kind: 'deliver',
        cue: "Deliver the manifest van to Sully's Custom Garage",
        place: 'sully',
        radius: 14,
      },
    ],
    outro: ['brandt', "We've got Damon's customs signatures cold. One more push and his harbor empire cracks."],
  },
  {
    id: 'm6',
    num: 6,
    giver: 'marco',
    giverPlace: 'marcoClub',
    title: 'Dockside Fireworks',
    sub: "Raid the Harbor Docks crane yard and eliminate Damon's heavy security team.",
    pay: 9000,
    rep: 320,
    intro: [
      ['marco', "Damon locked down the harbor cranes with six armed guards. Hit them hard — Tidewater's Solstice GL works wonders."],
      ['nico', 'Time to light up Harbor Docks.'],
    ],
    steps: [
      {
        kind: 'go',
        cue: 'Infiltrate the Harbor Docks container yard',
        x: 6 * BLOCK + 18,
        z: 3 * BLOCK + 16,
        radius: 22,
      },
      {
        kind: 'combat',
        cue: 'Eliminate all 6 Harbor Security guards',
        x: 6 * BLOCK + 28,
        z: 3 * BLOCK + 24,
        enemies: 6,
        wanted: 3,
      },
      {
        kind: 'evade',
        cue: 'Escape the VCPD response',
      },
    ],
    outro: ['marco', 'Half the harbor just flipped to our side. Damon is rattled up in Palm Heights.'],
  },
  {
    id: 'm7',
    num: 7,
    giver: 'sully',
    giverPlace: 'sully',
    title: 'Solaris Heist',
    sub: "Steal Damon's custom hypercar right off his Heights Estate driveway under heavy heat.",
    pay: 11500,
    rep: 380,
    intro: [
      ['sully', 'Damon keeps a custom pearl Solaris V12 at Heights Estate. Snatch it before he flies out tonight!'],
      ['nico', "I've been eyeing that V12 since day one."],
    ],
    steps: [
      {
        kind: 'steal',
        cue: "Steal Damon's Solaris V12 at Heights Estate",
        x: 4 * BLOCK + 26,
        z: 0 * BLOCK + 24,
        carModel: 'solaris',
        carPaint: '#ff2e93',
        carLabel: "Damon's Solaris V12",
        wanted: 4,
      },
      {
        kind: 'evade',
        cue: 'Outrun the 4-Star VCPD & Air-1 Chopper',
      },
      {
        kind: 'deliver',
        cue: 'Stash the Solaris V12 at Bayview Safehouse',
        place: 'safehouse',
        radius: 15,
      },
    ],
    outro: ['sully', "She's yours now, Jason. Keep the tank topped with nitrous — Damon will come looking."],
  },
  {
    id: 'm8',
    num: 8,
    giver: 'lupe',
    giverPlace: 'lupeBar',
    title: 'Vice Coast Kings',
    sub: "Confront Damon at Harbor Road's south dock and take Vice Coast for good.",
    pay: 25000,
    rep: 600,
    intro: [
      ['lupe', 'Damon is loading his last yacht at Harbor Road with every guard he has left. End it tonight, Jason.'],
      ['nico', 'Vice Coast belongs to the streets, not to Damon.'],
    ],
    steps: [
      {
        kind: 'go',
        cue: "Storm Damon's convoy at Harbor Road",
        x: 6 * BLOCK + 24,
        z: 6 * BLOCK + 20,
        radius: 24,
      },
      {
        kind: 'combat',
        cue: "Take down Damon's 8-man personal guard",
        x: 6 * BLOCK + 30,
        z: 6 * BLOCK + 26,
        enemies: 8,
        wanted: 4,
      },
      {
        kind: 'evade',
        cue: 'Lose the final VCPD dragnet',
      },
      {
        kind: 'deliver',
        cue: "Return to Lou's Pier Lounge for the sunset toast",
        place: 'lupeBar',
        radius: 15,
      },
    ],
    outro: ['lupe', "Look at that horizon, Jason. You're officially a Vice Coast Legend."],
  },
];

export const SIDE = {
  raceStart: { x: 0, z: 4 * BLOCK + 18, label: 'Boardwalk Rush' },
  raceGates: [
    [0, 3 * BLOCK],
    [0, 1 * BLOCK],
    [2 * BLOCK, 1 * BLOCK],
    [2 * BLOCK, 3 * BLOCK],
    [1 * BLOCK, 5 * BLOCK],
    [0, 5 * BLOCK],
  ] as [number, number][],
  conches: [
    [-26, 2 * BLOCK + 20],
    [-38, PIER_Z - 4],
    [1 * BLOCK + 32, 0 * BLOCK + 34],
    [4 * BLOCK + 28, 1 * BLOCK + 34],
    [3 * BLOCK + 30, 3 * BLOCK + 32],
    [5 * BLOCK + 30, 2 * BLOCK + 30],
    [2 * BLOCK + 28, 5 * BLOCK + 32],
    [4 * BLOCK + 34, 6 * BLOCK + 32],
    [6 * BLOCK + 32, 4 * BLOCK + 34],
    [7 * BLOCK + 26, 7 * BLOCK + 28],
  ] as [number, number][],
};
