import React, { useEffect, useRef } from 'react';
import type { HudSnapshot } from '../game/GameEngine.ts';
import type { ShopModalState } from '../game/economy/ShopsAndGarage.ts';
import {
  drawFullCityMap,
  mapCanvasToWorld,
} from '../game/ui/MinimapRenderer.ts';
import { PLACES } from '../game/missions/StoryMissions.ts';
import { WEATHER_SPECS, type WeatherMode } from '../game/core/WeatherRules.ts';
import { formatMoney } from '../game/core/MathUtil.ts';

interface PauseMapModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
  onSetWaypoint: (x: number, z: number) => void;
  onClearWaypoint: () => void;
  onFastTravel: (placeKey: string) => void;
  onCallCar: () => void;
  onSetWeather: (w: WeatherMode) => void;
}

const FAST_TRAVEL_KEYS = [
  'safehouse',
  'lupeBar',
  'sully',
  'guns',
  'marcoClub',
  'portGate',
  'villa',
  'pierEnd',
];

const WEATHER_LIST: WeatherMode[] = ['golden', 'storm', 'midnight', 'noon'];

export const PauseMapModal: React.FC<PauseMapModalProps> = ({
  hud,
  onResume,
  onRestart,
  onTitle,
  onSetWaypoint,
  onClearWaypoint,
  onFastTravel,
  onCallCar,
  onSetWeather,
}) => {
  const mapRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (mapRef.current) {
      drawFullCityMap(mapRef.current, hud.minimap);
    }
  }, [hud.minimap]);

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = mapRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const world = mapCanvasToWorld(cx, cy, canvas.width, canvas.height);
    onSetWaypoint(world.x, world.z);
  };

  return (
    <div className="fixed inset-0 z-30 bg-[#060414]/82 flex items-center justify-center p-5 select-none">
      <div className="hud-surface border border-[#00f0d8]/35 w-full max-w-[960px] max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/12">
          <div>
            <div className="font-display text-xs uppercase tracking-[0.26em] text-[#00f0d8]">
              Vice Coast Tactical Atlas
            </div>
            <h2 className="font-display italic font-extrabold uppercase text-3xl text-[#f7f4ff] leading-none mt-0.5">
              City Map & Dispatch
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResume}
              className="cursor-pointer px-5 py-2 bg-gradient-to-r from-[#ff2e93] to-[#ff6b6b] text-white font-display font-bold uppercase tracking-[0.14em] text-sm hover:brightness-110"
            >
              Resume [Esc]
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="cursor-pointer px-4 py-2 border border-white/20 text-slate-200 font-display uppercase tracking-[0.14em] text-sm hover:border-[#00f0d8]"
            >
              Restart
            </button>
            <button
              type="button"
              onClick={onTitle}
              className="cursor-pointer px-4 py-2 border border-[#ff2e93]/45 text-[#ff8ac6] font-display uppercase tracking-[0.14em] text-sm hover:border-[#ff2e93]"
            >
              Title
            </button>
          </div>
        </div>

        {/* Body Grid */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-6">
          {/* Left: Clickable Interactive Map */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-display uppercase tracking-[0.18em] text-slate-300">
                Click Map to Set GPS Waypoint
              </span>
              <button
                type="button"
                onClick={onClearWaypoint}
                className="cursor-pointer text-[11px] font-display uppercase tracking-[0.14em] text-[#00f0d8] hover:text-white"
              >
                Clear GPS
              </button>
            </div>
            <canvas
              ref={mapRef}
              width={440}
              height={440}
              onClick={handleMapClick}
              className="w-full aspect-square cursor-crosshair border border-[#00f0d8]/25 bg-[#0b162d]"
            />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono-num text-slate-300">
              <span><strong className="text-[#ff7c5c]">●</strong> Story</span>
              <span><strong className="text-[#00f0d8]">●</strong> Stunt Ramp</span>
              <span><strong className="text-[#ff9b54]">●</strong> Sully’s</span>
              <span><strong className="text-rose-400">●</strong> Tidewater</span>
              <span><strong className="text-[#ff2e93]">●</strong> Race</span>
            </div>
          </div>

          {/* Right: Fast Travel, Quick Actions, Atmosphere & Telemetry */}
          <div className="flex flex-col gap-5">
            {/* Career Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-white/[0.04] border border-white/10 p-2.5">
                <div className="text-[10px] font-display uppercase tracking-[0.16em] text-slate-400">
                  Story Progress
                </div>
                <div className="font-mono-num text-lg font-bold text-[#ff4da6]">
                  {hud.missionsDone}/{hud.missionsTotal}
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/10 p-2.5">
                <div className="text-[10px] font-display uppercase tracking-[0.16em] text-slate-400">
                  Golden Shells
                </div>
                <div className="font-mono-num text-lg font-bold text-[#00f0d8]">
                  {hud.conchesFound}/{hud.conchesTotal}
                </div>
              </div>
              <div className="bg-white/[0.04] border border-white/10 p-2.5">
                <div className="text-[10px] font-display uppercase tracking-[0.16em] text-slate-400">
                  Stunts / Best Jump
                </div>
                <div className="font-mono-num text-lg font-bold text-violet-300">
                  {hud.totalStuntCash} · {hud.longestJump}m
                </div>
              </div>
            </div>

            {/* Quick Vehicle Delivery & Weather */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-display uppercase tracking-[0.18em] text-slate-300">
                  Fleet & Atmosphere
                </span>
                <button
                  type="button"
                  onClick={onCallCar}
                  className="cursor-pointer px-3.5 py-1.5 bg-[#00f0d8]/15 border border-[#00f0d8]/60 text-[#b8fff8] font-display font-bold uppercase tracking-[0.14em] text-xs hover:bg-[#00f0d8]/25"
                >
                  Deliver Personal Car
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WEATHER_LIST.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onSetWeather(w)}
                    className={`cursor-pointer py-1.5 px-2 text-[11px] font-display uppercase tracking-[0.12em] border ${
                      hud.weather === w
                        ? 'border-[#ff2e93] bg-[#ff2e93]/20 text-[#ffb8dc] font-bold'
                        : 'border-white/15 text-slate-300 hover:border-[#00f0d8]/55'
                    }`}
                  >
                    {WEATHER_SPECS[w].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fast-Travel Landmarks */}
            <div>
              <div className="text-xs font-display uppercase tracking-[0.18em] text-slate-300 mb-2">
                Fast Travel (Available at 0 Wanted Stars)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FAST_TRAVEL_KEYS.map((key) => {
                  const p = PLACES[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={hud.wantedLevel > 0}
                      onClick={() => onFastTravel(key)}
                      className="cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between px-3 py-2 bg-white/[0.03] border border-white/12 hover:border-[#00f0d8]/65 text-left transition-colors"
                    >
                      <span className="text-xs text-slate-100 truncate pr-2">{p.label}</span>
                      <span
                        className="w-2 h-2 shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ShopModalProps {
  shop: ShopModalState;
  money: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  shop,
  money,
  onSelect,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-30 bg-[#060414]/78 flex items-center justify-center p-5 select-none">
      <div className="hud-surface border border-[#ff2e93]/45 w-full max-w-[680px] p-6">
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/12">
          <div>
            <div className="font-display text-xs uppercase tracking-[0.24em] text-[#00f0d8]">
              Vice Coast Service Bay
            </div>
            <h2 className="font-display italic font-extrabold uppercase text-3xl text-[#f7f4ff] leading-none mt-0.5">
              {shop.title}
            </h2>
            <p className="text-xs text-slate-300 mt-1">{shop.subtitle}</p>
          </div>
          <div className="text-right">
            <div className="font-mono-num text-xl font-bold text-[#00f0d8]">
              {formatMoney(money)}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer mt-1 px-3 py-1 border border-white/20 text-[11px] font-display uppercase tracking-[0.15em] text-slate-200 hover:border-[#ff2e93]"
            >
              Exit [Esc]
            </button>
          </div>
        </div>

        {/* Live Sully's Garage vehicle telemetry */}
        {shop.garage && (
          <div className="mt-4 p-3.5 bg-white/[0.04] border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] font-display uppercase tracking-[0.15em] text-slate-400">
                Top Speed
              </div>
              <div className="h-1.5 bg-white/10 mt-1">
                <div className="h-full bg-[#ff2e93]" style={{ width: `${shop.garage.speedPct}%` }} />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-display uppercase tracking-[0.15em] text-slate-400">
                Acceleration
              </div>
              <div className="h-1.5 bg-white/10 mt-1">
                <div className="h-full bg-[#00f0d8]" style={{ width: `${shop.garage.accelPct}%` }} />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-display uppercase tracking-[0.15em] text-slate-400">
                Hull Armor
              </div>
              <div className="h-1.5 bg-white/10 mt-1">
                <div className="h-full bg-violet-400" style={{ width: `${shop.garage.armorPct}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono-num">
              <span className="text-slate-300 uppercase">{shop.garage.finish}</span>
              <span
                className="w-4 h-4 border border-white/30"
                style={{ backgroundColor: shop.garage.paintHex }}
              />
            </div>
          </div>
        )}

        {/* Item rows */}
        <div className="mt-4 flex flex-col gap-2 max-h-[54vh] overflow-y-auto pr-1">
          {shop.items.map((item) => {
            const cantAfford = item.price > money;
            const disabled = !!item.disabled || cantAfford;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(item.id)}
                className="cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-between gap-4 px-3.5 py-2.5 bg-white/[0.03] border border-white/12 hover:border-[#00f0d8]/70 hover:bg-white/[0.06] text-left transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 shrink-0 flex items-center justify-center border border-[#ff2e93]/55 font-mono-num text-xs font-bold text-[#ff8ac6]">
                    {item.key}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#f7f4ff] truncate">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-300/85 truncate">{item.sub}</div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`font-mono-num text-sm font-bold ${
                      item.price === 0
                        ? 'text-[#00f0d8]'
                        : cantAfford
                          ? 'text-rose-400'
                          : 'text-[#00f0d8]'
                    }`}
                  >
                    {item.price === 0 ? 'FREE' : formatMoney(item.price)}
                  </div>
                  {item.badge && (
                    <div className="text-[10px] font-display uppercase tracking-[0.16em] text-slate-400">
                      {item.badge}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface DownedModalProps {
  hud: HudSnapshot;
  onRecover: () => void;
  onTitle: () => void;
}

export const DownedModal: React.FC<DownedModalProps> = ({
  hud,
  onRecover,
  onTitle,
}) => {
  const isBusted = hud.downedCause === 'busted';
  return (
    <div className="fixed inset-0 z-30 bg-[#060414]/84 flex items-center justify-center p-6 select-none">
      <div className="hud-surface-pink max-w-md w-full p-7 text-center">
        <div className="font-display text-xs uppercase tracking-[0.26em] text-[#ff5cb0]">
          {isBusted ? 'VCPD Custody' : 'Mercy Coastal Trauma'}
        </div>
        <h2 className="font-display italic font-extrabold uppercase text-6xl text-[#ff2e93] leading-none mt-1 hud-stroke">
          {isBusted ? 'BUSTED' : 'WASTED'}
        </h2>
        <p className="mt-3 text-sm text-slate-200">
          {isBusted
            ? 'VCPD intercepted you on the streets of Vice Coast. Pay bail and get back behind the wheel.'
            : 'Nick was rushed to Mercy Coastal Clinic. Recover and reclaim the coast.'}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 text-left">
          <div className="bg-white/[0.04] border border-white/10 p-2.5">
            <div className="text-[10px] font-display uppercase tracking-[0.15em] text-slate-400">
              Cash on Hand
            </div>
            <div className="font-mono-num text-base font-bold text-[#00f0d8]">
              {formatMoney(hud.money)}
            </div>
          </div>
          <div className="bg-white/[0.04] border border-white/10 p-2.5">
            <div className="text-[10px] font-display uppercase tracking-[0.15em] text-slate-400">
              Respect Rank
            </div>
            <div className="font-mono-num text-base font-bold text-[#ff5cb0]">
              R{hud.repLevel} · {hud.repTitle}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRecover}
            className="cursor-pointer w-full py-3 bg-gradient-to-r from-[#ff2e93] to-[#ff6b6b] text-white font-display font-bold uppercase tracking-[0.16em] text-base hover:brightness-110"
          >
            {isBusted ? 'Post Bail & Resume' : 'Leave Clinic & Resume'}
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="cursor-pointer w-full py-2.5 border border-white/20 text-slate-200 font-display uppercase tracking-[0.14em] text-sm hover:border-[#00f0d8]"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
};
