export type WeatherMode = 'golden' | 'storm' | 'midnight' | 'noon';

export interface WeatherSpec {
  id: WeatherMode;
  label: string;
  shortLabel: string;
  defaultHour: number;
  rainIntensity: number; // 0..1
  roadRoughness: number; // lower = wet reflective asphalt
  roadMetalness: number;
  gripScale: number; // rain makes cars slightly looser for fun drifts
  fogDensity: number;
  cloudBoost: number; // pushes fbm cloud coverage higher
  sunDim: number; // multiplier on direct sun light
  ambientTint: string;
}

export const WEATHER_ORDER: readonly WeatherMode[] = [
  'golden',
  'storm',
  'midnight',
  'noon',
];

export const WEATHER_SPECS: Record<WeatherMode, WeatherSpec> = {
  golden: {
    id: 'golden',
    label: 'Golden Hour',
    shortLabel: 'GOLDEN',
    defaultHour: 17.5,
    rainIntensity: 0,
    roadRoughness: 0.96,
    roadMetalness: 0.01,
    gripScale: 1.0,
    fogDensity: 0.00145,
    cloudBoost: 0,
    sunDim: 1.0,
    ambientTint: '#ffcf9e',
  },
  storm: {
    id: 'storm',
    label: 'Tropical Storm',
    shortLabel: 'STORM',
    defaultHour: 16.4,
    rainIntensity: 1.0,
    roadRoughness: 0.34,
    roadMetalness: 0.16,
    gripScale: 0.82,
    fogDensity: 0.0028,
    cloudBoost: 0.32,
    sunDim: 0.42,
    ambientTint: '#8daec9',
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight Neon',
    shortLabel: 'NIGHT',
    defaultHour: 22.8,
    rainIntensity: 0.2,
    roadRoughness: 0.56,
    roadMetalness: 0.1,
    gripScale: 0.94,
    fogDensity: 0.0019,
    cloudBoost: 0.08,
    sunDim: 0.8,
    ambientTint: '#6b7fff',
  },
  noon: {
    id: 'noon',
    label: 'Coastal Noon',
    shortLabel: 'NOON',
    defaultHour: 12.6,
    rainIntensity: 0,
    roadRoughness: 0.98,
    roadMetalness: 0.0,
    gripScale: 1.04,
    fogDensity: 0.0011,
    cloudBoost: -0.08,
    sunDim: 1.05,
    ambientTint: '#d6eaff',
  },
};

export function nextWeatherMode(current: WeatherMode): WeatherMode {
  const idx = WEATHER_ORDER.indexOf(current);
  return WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
}
