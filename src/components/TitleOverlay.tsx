import React from 'react';
import { WEATHER_SPECS, type WeatherMode } from '../game/core/WeatherRules.ts';

interface TitleOverlayProps {
  hasSave: boolean;
  weather: WeatherMode;
  onNewGame: () => void;
  onContinue: () => void;
  onSelectWeather: (w: WeatherMode) => void;
}

const WEATHER_OPTIONS: WeatherMode[] = ['golden', 'storm', 'midnight', 'noon'];

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  hasSave,
  weather,
  onNewGame,
  onContinue,
  onSelectWeather,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none select-none">
      {/* Subtle left-side midnight-indigo gradient scrim so title stays razor-sharp over bright sunsets */}
      <div
        className="absolute inset-y-0 left-0 w-[56%] max-w-[760px] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(10,7,24,0.88) 0%, rgba(12,8,28,0.54) 56%, rgba(10,7,24,0) 100%)',
        }}
      />

      {/* Top-left subtle coastal chapter stamp */}
      <div className="relative z-10 px-10 pt-8 flex items-center gap-3">
        <span className="h-[2px] w-8 bg-[#00f0d8]" />
        <span className="font-display text-xs tracking-[0.28em] uppercase text-[#00f0d8] font-semibold gta-text-shadow">
          Jason Vance &amp; Lucia Reyes · Leonida Coast
        </span>
      </div>

      {/* Main asymmetric left-third title stack */}
      <div className="relative z-10 px-10 max-w-xl pointer-events-auto">
        {/* Bespoke inline SVG Vice Coast Neon Sun & Palm Emblem */}
        <svg
          width="78"
          height="48"
          viewBox="0 0 74 46"
          fill="none"
          className="mb-3"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="vc-sun" x1="0" y1="0" x2="0" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00f0d8" />
              <stop offset="48%" stopColor="#ff2e93" />
              <stop offset="100%" stopColor="#ff7c5c" />
            </linearGradient>
          </defs>
          <path d="M14 34 A23 23 0 0 1 60 34 Z" fill="url(#vc-sun)" />
          <rect x="8" y="21" width="58" height="2.2" fill="#0b081b" />
          <rect x="6" y="26.5" width="62" height="2.5" fill="#0b081b" />
          <rect x="4" y="32" width="66" height="2.8" fill="#0b081b" />
          <path d="M0 39 H74" stroke="#00f0d8" strokeWidth="1.6" />
          <path d="M12 43 H62" stroke="#ff2e93" strokeWidth="1.2" strokeOpacity="0.85" />
        </svg>

        <h1 className="font-display italic font-extrabold uppercase text-[72px] sm:text-[90px] leading-[0.84] tracking-tight text-[#f7f4ff] drop-shadow-[0_6px_22px_rgba(0,0,0,0.78)]">
          VICE
          <span className="block text-[#ff2e93] drop-shadow-[0_4px_26px_rgba(255,46,147,0.55)]">
            COAST
          </span>
        </h1>

        <p className="mt-4 text-sm sm:text-[15px] text-slate-200/95 max-w-md leading-relaxed gta-text-shadow">
          Switch seamlessly between Jason and Lucia, launch Ocean Drive stunt ramps with twin-stage nitrous, track live ViceGram hotspots, and own Vice Coast across 8 story chapters.
        </p>

        {/* Primary CTA cluster */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onNewGame();
            }}
            className="cursor-pointer px-8 py-3.5 rounded-[4px] bg-gradient-to-r from-[#ff2e93] to-[#ff6b6b] text-white font-display font-bold uppercase tracking-[0.16em] text-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_10px_30px_rgba(255,46,147,0.44)]"
          >
            Enter Story Mode
          </button>

          {hasSave && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onContinue();
              }}
              className="cursor-pointer px-6 py-3.5 rounded-[4px] bg-[#0f0b24]/92 border border-[#00f0d8]/60 text-[#e8fffc] font-display font-bold uppercase tracking-[0.14em] text-lg hover:border-[#00f0d8] hover:bg-[#161136] transition-all"
            >
              Continue Save
            </button>
          )}
        </div>

        {/* Live Atmosphere Selector on Title */}
        <div className="mt-7">
          <div className="text-[11px] font-display uppercase tracking-[0.22em] text-[#00f0d8]/90 mb-2 gta-text-shadow">
            Live Coastal Atmosphere
          </div>
          <div className="flex flex-wrap gap-2">
            {WEATHER_OPTIONS.map((w) => {
              const active = weather === w;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectWeather(w);
                  }}
                  className={`cursor-pointer px-3 py-1.5 rounded-[4px] text-xs font-display uppercase tracking-[0.14em] border transition-colors ${
                    active
                      ? 'bg-[#00f0d8]/18 border-[#00f0d8] text-[#b8fff8] font-bold'
                      : 'bg-[#0d0a1f]/82 border-white/15 text-slate-300 hover:border-[#ff2e93]/60 hover:text-white'
                  }`}
                >
                  {WEATHER_SPECS[w].label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Flat bottom single-line controls legend */}
      <div className="relative z-10 px-10 pb-6 flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono-num tracking-wider text-slate-200/90 gta-text-shadow">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span><strong className="text-[#00f0d8]">WASD</strong> MOVE / DRIVE</span>
          <span><strong className="text-[#ff2e93]">F</strong> ENTER CAR</span>
          <span><strong className="text-[#00f0d8]">G</strong> SWITCH DUO</span>
          <span><strong className="text-[#ff2e93]">Q</strong> FOCUS</span>
          <span><strong className="text-[#00f0d8]">TAB</strong> WEAPONS</span>
          <span><strong className="text-[#ff2e93]">T</strong> PHONE</span>
          <span><strong className="text-[#00f0d8]">M</strong> CITY MAP</span>
        </div>
        <div className="text-[#00f0d8]/95">PRESS ENTER TO START</div>
      </div>
    </div>
  );
};
