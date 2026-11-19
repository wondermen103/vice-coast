import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Car,
  Compass,
  Crosshair,
  Heart,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Shield,
  Smartphone,
  Sparkles,
  UserCheck,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type {
  BannerItem,
  DialogueItem,
  HudSnapshot,
  ToastItem,
  WeaponWheelItem,
} from '../game/GameEngine.ts';
import { formatMoney } from '../game/core/MathUtil.ts';
import { PLACES, STORY, VICEGRAM_POSTS } from '../game/missions/StoryMissions.ts';

interface PlayingHudProps {
  hud: HudSnapshot;
  toasts: ToastItem[];
  banner: BannerItem | null;
  dialogue: DialogueItem | null;
  moneyPop: { id: number; amount: number } | null;
  damageFlash: boolean;
  hitmarkerKey: number;
  onMountRadar: (canvas: HTMLCanvasElement | null) => void;
  onToggleMute: () => void;
  onCycleWeather: () => void;
  onCycleCamera: () => void;
  onOpenPause: () => void;
  onNextRadio: () => void;
  onSwitchProtagonist: () => void;
  onToggleFocus: () => void;
  onToggleWeaponWheel: () => void;
  onSelectWeapon: (idx: number) => void;
  onTogglePhone: (open?: boolean) => void;
  onTrackViceGram: (postId: string) => void;
  onFastTravel: (placeKey: string) => void;
  onCallCar: () => void;
  onSetWaypoint: (x: number, z: number) => void;
}

const StarSvg: React.FC<{ filled: boolean; alerting: boolean }> = ({
  filled,
  alerting,
}) => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
    <path
      d="M12 2.4l2.9 6.1 6.7.9-4.9 4.7 1.2 6.7L12 17.6 6.1 20.8l1.2-6.7-4.9-4.7 6.7-.9L12 2.4z"
      fill={filled ? (alerting ? '#ff2e93' : '#f8fafc') : 'rgba(255,255,255,0.16)'}
      stroke={filled ? '#090b14' : 'rgba(9,11,20,0.65)'}
      strokeWidth="1.4"
    />
  </svg>
);

const WeaponWheelOverlay: React.FC<{
  weapons: WeaponWheelItem[];
  selectedIndex: number;
  onSelect: (idx: number) => void;
  onClose: () => void;
}> = ({ weapons, selectedIndex, onSelect, onClose }) => {
  const [hoverIdx, setHoverIdx] = useState<number>(selectedIndex);
  const active = weapons[hoverIdx] ?? weapons[selectedIndex] ?? weapons[0];
  const radius = 148;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center pointer-events-auto"
      style={{ background: 'radial-gradient(circle at center, rgba(10,12,24,0.48) 0%, rgba(7,8,16,0.72) 100%)' }}
      onClick={onClose}
    >
      <div
        className="relative w-[400px] h-[400px] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Outer architectural guide ring */}
        <div className="absolute inset-8 rounded-full border border-white/15 pointer-events-none" />
        <div className="absolute inset-24 rounded-full border border-[#00f0d8]/25 pointer-events-none" />

        {/* 6 Radial Weapon Slots */}
        {weapons.map((w, i) => {
          const angle = (i / weapons.length) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const isEquipped = w.index === selectedIndex;
          const isHovered = w.index === hoverIdx;
          return (
            <button
              key={w.id}
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setHoverIdx(w.index)}
              onClick={() => {
                if (w.owned) onSelect(w.index);
              }}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              className={`absolute w-[124px] px-2.5 py-2 rounded-md text-left transition-all border ${
                !w.owned
                  ? 'bg-[#0b0d18]/75 border-white/10 opacity-45 cursor-not-allowed'
                  : isEquipped
                    ? 'bg-[#ff2e93]/25 border-[#ff2e93] shadow-[0_0_24px_rgba(255,46,147,0.35)] cursor-pointer'
                    : isHovered
                      ? 'bg-[#00f0d8]/20 border-[#00f0d8] cursor-pointer'
                      : 'bg-[#0c0e1c]/90 border-white/20 hover:border-[#00f0d8] cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono-num text-[10px] text-slate-400">
                  {i + 1}
                </span>
                <span className="font-mono-num text-[11px] font-bold text-[#00f0d8]">
                  {!w.owned ? 'LOCK' : w.ammo === null ? '∞' : w.ammo}
                </span>
              </div>
              <div className="font-display font-bold uppercase tracking-[0.08em] text-[13px] text-white leading-tight mt-0.5 truncate">
                {w.name}
              </div>
              <div className="text-[10px] text-slate-300/80 uppercase tracking-wider truncate">
                {w.role}
              </div>
            </button>
          );
        })}

        {/* Center Weapon Telemetry Hub */}
        <div className="w-[158px] h-[158px] rounded-full gta-panel border-[#00f0d8]/35 flex flex-col items-center justify-center px-4 text-center">
          <div className="text-[9px] font-display uppercase tracking-[0.22em] text-[#ff5cb0] font-bold">
            WEAPON WHEEL · TAB
          </div>
          <div className="mt-1 font-display font-extrabold uppercase tracking-[0.08em] text-lg text-white leading-none">
            {active.name}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-300 uppercase tracking-wider">
            {active.owned
              ? active.ammo === null
                ? 'UNLIMITED'
                : `${active.ammo} ROUNDS`
              : 'BUY AT TIDEWATER'}
          </div>

          <div className="w-full mt-2.5 flex flex-col gap-1.5 text-left">
            <div>
              <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-300">
                <span>Damage</span>
                <span className="font-mono-num text-[#00f0d8]">{Math.min(100, Math.round((active.dmg / 145) * 100))}</span>
              </div>
              <div className="h-1 bg-white/15 mt-0.5 overflow-hidden">
                <div
                  className="h-full bg-[#00f0d8]"
                  style={{ width: `${Math.min(100, Math.round((active.dmg / 145) * 100))}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-300">
                <span>Fire Rate</span>
                <span className="font-mono-num text-[#ff5cb0]">{Math.min(100, Math.round((active.rate / 11) * 100))}</span>
              </div>
              <div className="h-1 bg-white/15 mt-0.5 overflow-hidden">
                <div
                  className="h-full bg-[#ff2e93]"
                  style={{ width: `${Math.min(100, Math.round((active.rate / 11) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type PhoneTab = 'vicegram' | 'rydeme' | 'story';

const ViceSmartphone: React.FC<{
  hud: HudSnapshot;
  onClose: () => void;
  onTrackViceGram: (postId: string) => void;
  onFastTravel: (placeKey: string) => void;
  onCallCar: () => void;
  onSwitchProtagonist: () => void;
  onSetWaypoint: (x: number, z: number) => void;
}> = ({
  hud,
  onClose,
  onTrackViceGram,
  onFastTravel,
  onCallCar,
  onSwitchProtagonist,
  onSetWaypoint,
}) => {
  const [tab, setTab] = useState<PhoneTab>('vicegram');
  const nextStory = STORY[Math.min(STORY.length - 1, hud.missionsDone)];
  const nextPlace = nextStory ? PLACES[nextStory.giverPlace] : PLACES.lupeBar;
  const travelPlaces = Object.entries(PLACES).filter(([, p]) => p.fastTravel);

  return (
    <div className="fixed bottom-4 right-5 z-30 pointer-events-auto w-[292px] rounded-[24px] bg-[#0a0c16] border-[2px] border-white/20 shadow-[0_24px_56px_rgba(0,0,0,0.82)] overflow-hidden flex flex-col">
      {/* Smartphone Top Notch & Status Bar */}
      <div className="px-4 pt-2.5 pb-2 bg-[#101324] border-b border-white/10 flex items-center justify-between">
        <span className="font-mono-num text-[11px] font-bold text-slate-200">{hud.clock}</span>
        <div className="w-16 h-3 rounded-full bg-black/80 border border-white/10" />
        <div className="flex items-center gap-2">
          <span className="font-mono-num text-[10px] font-bold text-[#00f0d8]">5G VC</span>
          <button
            type="button"
            tabIndex={-1}
            onClick={onClose}
            aria-label="Close Phone"
            className="cursor-pointer text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* App Switcher Bar */}
      <div className="grid grid-cols-3 bg-[#0d1020] border-b border-white/10 text-[11px] font-display uppercase tracking-[0.12em] font-bold">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setTab('vicegram')}
          className={`cursor-pointer py-2 flex items-center justify-center gap-1 border-b-2 transition-colors ${
            tab === 'vicegram'
              ? 'border-[#ff2e93] text-[#ff70b8] bg-[#ff2e93]/10'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          ViceGram
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setTab('rydeme')}
          className={`cursor-pointer py-2 flex items-center justify-center gap-1 border-b-2 transition-colors ${
            tab === 'rydeme'
              ? 'border-[#00f0d8] text-[#7cfff2] bg-[#00f0d8]/10'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          RydeMe
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setTab('story')}
          className={`cursor-pointer py-2 flex items-center justify-center gap-1 border-b-2 transition-colors ${
            tab === 'story'
              ? 'border-violet-400 text-violet-200 bg-violet-400/10'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          Story
        </button>
      </div>

      {/* Scrollable App Viewport */}
      <div className="h-[348px] overflow-y-auto p-3 flex flex-col gap-2.5 bg-[#090b14]">
        {tab === 'vicegram' && (
          <>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-400 px-0.5">
              <span>Live Leonida Feed</span>
              <span className="text-[#ff5cb0] font-bold">TRENDING</span>
            </div>
            {VICEGRAM_POSTS.map((post) => (
              <div
                key={post.id}
                className="rounded-lg bg-[#121629] border border-white/10 p-2.5 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-num text-[11px] font-bold text-white truncate">
                    {post.handle}
                  </span>
                  <span
                    className="font-display text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: post.accent }}
                  >
                    {post.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-200 leading-snug">{post.caption}</p>
                <div className="flex items-center justify-between pt-1 border-t border-white/10">
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Heart className="w-3 h-3 text-[#ff2e93]" />
                    {post.likes} · {post.location}
                  </span>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => onTrackViceGram(post.id)}
                    className="cursor-pointer px-2 py-0.5 rounded bg-[#00f0d8]/15 border border-[#00f0d8]/50 text-[#86fff3] font-display text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-[#00f0d8]/25"
                  >
                    GPS
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'rydeme' && (
          <>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                onCallCar();
                onClose();
              }}
              className="cursor-pointer w-full rounded-lg bg-gradient-to-r from-[#ff2e93] to-[#ff6b6b] px-3 py-2.5 text-left flex items-center justify-between shadow-[0_6px_18px_rgba(255,46,147,0.3)] hover:brightness-110"
            >
              <div>
                <div className="font-display font-bold uppercase tracking-[0.14em] text-sm text-white">
                  Deliver Personal Car
                </div>
                <div className="text-[10px] text-white/85">
                  Instant curbside drop with Nitrous
                </div>
              </div>
              <Car className="w-5 h-5 text-white shrink-0" />
            </button>

            <div className="text-[10px] font-display uppercase tracking-[0.18em] text-slate-400 pt-1">
              Quick Fast-Travel Dropoffs
            </div>
            <div className="flex flex-col gap-1.5">
              {travelPlaces.map(([key, place]) => (
                <button
                  key={key}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onFastTravel(key)}
                  className="cursor-pointer rounded-md bg-[#121629] border border-white/10 hover:border-[#00f0d8]/60 px-2.5 py-2 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: place.color }} />
                    <span className="text-xs text-slate-100 truncate">{place.label}</span>
                  </div>
                  <span className="font-display text-[10px] uppercase tracking-wider text-[#00f0d8]">
                    GO
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'story' && (
          <>
            <div className="rounded-lg bg-[#121629] border border-white/12 p-3">
              <div className="flex items-center justify-between text-[10px] font-display uppercase tracking-[0.16em] text-[#ff5cb0] font-bold">
                <span>Chapter {hud.storyChapter} of {hud.missionsTotal}</span>
                <span>{hud.missionsDone}/{hud.missionsTotal} DONE</span>
              </div>
              <div className="mt-1 font-display font-bold uppercase text-base text-white">
                {hud.mission ? hud.mission.title : nextStory?.title ?? 'Vice Coast Legend'}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-300 leading-snug">
                {hud.mission ? hud.mission.cue : nextStory?.sub ?? 'Explore Vice Coast freely.'}
              </p>
              {!hud.mission && nextPlace && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    onSetWaypoint(nextPlace.x, nextPlace.z);
                    onClose();
                  }}
                  className="cursor-pointer mt-2.5 w-full py-1.5 rounded bg-[#00f0d8]/18 border border-[#00f0d8]/55 text-[#9efffa] font-display text-xs font-bold uppercase tracking-[0.14em] flex items-center justify-center gap-1.5 hover:bg-[#00f0d8]/28"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Route to {nextPlace.label}
                </button>
              )}
            </div>

            <div className="rounded-lg bg-[#121629] border border-white/12 p-3">
              <div className="text-[10px] font-display uppercase tracking-[0.16em] text-slate-400">
                Active Duo · Jason & Lucia
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <div>
                  <div
                    className="font-display font-bold uppercase text-sm"
                    style={{ color: hud.protagonistAccent }}
                  >
                    {hud.protagonistName}
                  </div>
                  <div className="text-[10px] text-slate-300">{hud.protagonistPerk}</div>
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    onSwitchProtagonist();
                    onClose();
                  }}
                  className="cursor-pointer px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-display text-[11px] font-bold uppercase tracking-[0.12em] flex items-center gap-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Switch [G]
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-[#121629] border border-white/10 p-2.5 flex items-center justify-between text-[11px]">
              <span className="text-slate-300">Street Respect</span>
              <span className="font-display font-bold uppercase text-[#ff70b8]">
                R{hud.repLevel} · {hud.repTitle}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Smartphone Home Bar */}
      <div className="py-2 bg-[#0c0f1c] border-t border-white/10 flex items-center justify-center">
        <button
          type="button"
          tabIndex={-1}
          onClick={onClose}
          className="cursor-pointer w-20 h-1 rounded-full bg-white/30 hover:bg-white/60"
          aria-label="Close Phone"
        />
      </div>
    </div>
  );
};

export const PlayingHud: React.FC<PlayingHudProps> = ({
  hud,
  toasts,
  banner,
  dialogue,
  moneyPop,
  damageFlash,
  hitmarkerKey,
  onMountRadar,
  onToggleMute,
  onCycleWeather,
  onCycleCamera,
  onOpenPause,
  onNextRadio,
  onSwitchProtagonist,
  onToggleFocus,
  onToggleWeaponWheel,
  onSelectWeapon,
  onTogglePhone,
  onTrackViceGram,
  onFastTravel,
  onCallCar,
  onSetWaypoint,
}) => {
  const radarRef = useRef<HTMLCanvasElement | null>(null);
  const ghostHealthRef = useRef(hud.health);

  useEffect(() => {
    onMountRadar(radarRef.current);
    return () => onMountRadar(null);
  }, [onMountRadar]);

  if (hud.health > ghostHealthRef.current) {
    ghostHealthRef.current = hud.health;
  } else {
    ghostHealthRef.current += (hud.health - ghostHealthRef.current) * 0.2;
  }

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Subtle electric-crimson perimeter damage vignette */}
      <div
        className="fixed inset-0 transition-opacity duration-200 pointer-events-none"
        style={{
          opacity: damageFlash ? 1 : 0,
          boxShadow: 'inset 0 0 95px rgba(255, 46, 147, 0.72)',
        }}
      />

      {/* GTA VI Focus / Dead-Eye Mode subtle violet perimeter vignette */}
      <div
        className="fixed inset-0 transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: hud.focusActive ? 1 : 0,
          boxShadow: 'inset 0 0 110px rgba(168, 85, 247, 0.45)',
        }}
      />

      {/* TOP-LEFT: Clean Mission Strip + VCPD Dispatch when Wanted */}
      <div className="absolute top-4 left-5 flex flex-col gap-2 max-w-[320px]">
        {hud.mission && (
          <div className="gta-panel rounded-md px-3.5 py-2.5 border-l-2 border-l-[#00f0d8]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display font-bold uppercase tracking-[0.14em] text-[13px] text-[#00f0d8]">
                {hud.mission.title}
              </span>
              {hud.mission.timer !== null && (
                <span className="font-mono-num text-xs font-bold text-[#ff2e93]">
                  {Math.max(0, Math.ceil(hud.mission.timer))}s
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-slate-100 leading-snug">
              {hud.mission.cue}
            </p>
            {hud.mission.totalSteps > 1 && (
              <div className="mt-2 flex gap-1">
                {Array.from({ length: hud.mission.totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-[3px] flex-1 ${
                      i < hud.mission!.stepIndex
                        ? 'bg-[#00f0d8]'
                        : i === hud.mission!.stepIndex
                          ? 'bg-[#ff2e93]'
                          : 'bg-white/15'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {hud.wantedLevel > 0 && hud.policeRoster.length > 0 && (
          <div className="hud-surface-pink rounded-md px-3 py-2">
            <div className="flex items-center justify-between text-[10px] font-display uppercase tracking-[0.2em] text-[#ff70b8] font-bold mb-1">
              <span>VCPD Dispatch</span>
              <span>{hud.wantedSeen ? 'VISUAL LOCK' : 'EVADING'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {hud.policeRoster.map((u, idx) => (
                <div
                  key={`${u.label}-${idx}`}
                  className="flex items-center justify-between text-[11px] font-mono-num text-slate-200"
                >
                  <span className="truncate max-w-[140px]">{u.label}</span>
                  <span className="text-[#ff6cb8]">{u.role}</span>
                  <span className="text-slate-300">{u.dist}m</span>
                </div>
              ))}
            </div>
            {!hud.wantedSeen && (
              <div className="mt-1.5 h-[3px] bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-[#00f0d8] transition-all duration-100"
                  style={{ width: `${Math.round(hud.wantedEvadePct * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* TOP-RIGHT: Minimalist GTA VI Floating Cash, 5-Star Wanted, Weapon Readout & Utility Row */}
      <div className="absolute top-4 right-5 flex flex-col items-end gap-1.5">
        {/* Compact Utility Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            title="Vice Smartphone (T)"
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePhone();
            }}
            className={`cursor-pointer px-2 h-7 rounded-[4px] gta-panel flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-wider transition-colors ${
              hud.phoneOpen
                ? 'border-[#ff2e93] text-[#ff85c4]'
                : 'text-slate-200 hover:border-[#00f0d8]'
            }`}
          >
            <Smartphone className="w-3 h-3" />
            PHONE
          </button>
          <button
            type="button"
            tabIndex={-1}
            title="Weapon Wheel (Tab)"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleWeaponWheel();
            }}
            className={`cursor-pointer px-2 h-7 rounded-[4px] gta-panel flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-wider transition-colors ${
              hud.weaponWheelOpen
                ? 'border-[#00f0d8] text-[#86fff3]'
                : 'text-slate-200 hover:border-[#00f0d8]'
            }`}
          >
            <Crosshair className="w-3 h-3" />
            WHEEL
          </button>
          <button
            type="button"
            tabIndex={-1}
            title="Cycle Weather (V)"
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleWeather();
            }}
            className="cursor-pointer px-2 h-7 rounded-[4px] gta-panel text-[10px] font-display font-bold uppercase tracking-wider text-[#ff85c4] hover:border-[#ff2e93]"
          >
            SKY
          </button>
          <button
            type="button"
            tabIndex={-1}
            title="Cycle Camera (C)"
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleCamera();
            }}
            className="cursor-pointer px-2 h-7 rounded-[4px] gta-panel text-[10px] font-display font-bold uppercase tracking-wider text-[#00f0d8] hover:border-[#00f0d8]"
          >
            CAM
          </button>
          <button
            type="button"
            tabIndex={-1}
            title="City Map & Pause (M)"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenPause();
            }}
            className="cursor-pointer px-2 h-7 rounded-[4px] gta-panel text-[10px] font-display font-bold uppercase tracking-wider text-white hover:border-[#ff2e93]"
          >
            MAP
          </button>
          <button
            type="button"
            tabIndex={-1}
            title="Toggle Audio (U)"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="cursor-pointer w-7 h-7 rounded-[4px] gta-panel flex items-center justify-center text-slate-200 hover:border-[#00f0d8]"
          >
            {hud.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Floating Unboxed GTA Cash Counter */}
        <div className="relative mt-1 text-right">
          <div className="font-mono-num text-[30px] font-extrabold leading-none tracking-tight text-[#d8fff2] gta-text-shadow">
            {formatMoney(hud.money)}
          </div>
          {moneyPop && (
            <div
              key={moneyPop.id}
              className="anim-money-pop absolute top-1.5 right-full mr-2.5 whitespace-nowrap font-mono-num text-sm font-bold text-[#00f0d8] gta-text-shadow"
            >
              +{formatMoney(moneyPop.amount)}
            </div>
          )}
        </div>

        {/* Floating 5-Star Wanted Row */}
        <div className="flex items-center gap-0.5 mt-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <StarSvg
              key={n}
              filled={n <= hud.wantedLevel}
              alerting={hud.wantedSeen && hud.wantedLevel >= 3}
            />
          ))}
        </div>

        {/* Floating Minimalist Active Weapon & Ammo Readout */}
        <div className="flex items-center gap-2 mt-0.5 gta-text-shadow">
          <span className="font-display font-bold uppercase tracking-[0.14em] text-sm text-white">
            {hud.weaponName}
          </span>
          <span className="font-mono-num text-sm font-bold text-[#ff5cb0]">
            {hud.weaponAmmo === null ? '∞' : hud.weaponAmmo}
          </span>
        </div>
      </div>

      {/* CENTER: Precision Reticle + Hitmarker + Focus Tag + Mission Banner */}
      {!hud.inVehicle && !hud.weaponWheelOpen && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="1.4" fill={hud.focusActive ? '#c084fc' : '#ffffff'} />
            <path
              d="M12 4v3M12 17v3M4 12h3M17 12h3"
              stroke={hud.focusActive ? 'rgba(192,132,252,0.85)' : 'rgba(255,255,255,0.72)'}
              strokeWidth="1.2"
            />
          </svg>
        </div>
      )}

      {hitmarkerKey > 0 && (
        <div
          key={`hit-${hitmarkerKey}`}
          className="anim-hitmarker absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        >
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <path
              d="M6 6l5 5M22 6l-5 5M6 22l5-5M22 22l-5-5"
              stroke="#ff2e93"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {/* Active Focus Mode Micro-Banner */}
      {hud.focusActive && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 px-3 py-1 rounded bg-[#140d28]/90 border border-violet-400/70 text-[11px] font-display font-bold uppercase tracking-[0.2em] text-violet-200">
          FOCUS MODE · SLOW-MO [Q]
        </div>
      )}

      {/* Dramatic GTA-style Mission / Chapter Banner */}
      {banner && (
        <div
          key={`banner-${banner.id}`}
          className="absolute top-20 left-1/2 -translate-x-1/2 text-center px-7 py-3 rounded-md bg-[#0b0c18]/88 border-y border-[#ff2e93]/55 max-w-xl"
        >
          <div
            className={`font-display italic font-extrabold uppercase tracking-[0.14em] text-2xl leading-none ${
              banner.kind === 'pass'
                ? 'text-[#00f0d8]'
                : banner.kind === 'fail'
                  ? 'text-rose-400'
                  : 'text-[#ff52a8]'
            }`}
          >
            {banner.title}
          </div>
          <div className="mt-1 text-xs text-slate-200 tracking-wide">{banner.sub}</div>
        </div>
      )}

      {/* Compact Toast Stack */}
      {toasts.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-3.5 py-1 rounded-[4px] gta-panel text-[11px] font-display uppercase tracking-[0.16em] font-semibold ${
                t.kind === 'good'
                  ? 'border-[#00f0d8]/60 text-[#b8fff8]'
                  : t.kind === 'bad'
                    ? 'border-[#ff2e93]/70 text-[#ffb0d8]'
                    : t.kind === 'rep'
                      ? 'border-fuchsia-400/60 text-fuchsia-200'
                      : 'border-white/25 text-slate-100'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* Contextual Action Prompt */}
      {hud.hint && !hud.weaponWheelOpen && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-[4px] gta-panel border-[#00f0d8]/55 text-xs font-display uppercase tracking-[0.16em] text-[#e2fffc]">
          {hud.hint}
        </div>
      )}

      {/* Authentic Rockstar-Style Bottom-Center Cinematic Subtitles (Zero heavy box!) */}
      {dialogue && !hud.weaponWheelOpen && (
        <div
          key={`dialogue-${dialogue.id}`}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-2xl w-[86%] text-center px-4"
        >
          <p className="text-[15px] sm:text-[16px] font-medium text-white leading-snug gta-subtitle-shadow">
            <span
              className="font-display font-bold uppercase tracking-[0.1em] mr-2"
              style={{ color: dialogue.color }}
            >
              {dialogue.speaker}:
            </span>
            {dialogue.text}
          </p>
        </div>
      )}

      {/* BOTTOM-LEFT: Realistic GTA VI Satellite GPS Radar + 3 Fused Vitality Bars Underneath */}
      <div className="absolute bottom-4 left-5 flex flex-col w-[264px]">
        {/* Unboxed floating District & Street readout directly above radar */}
        <div className="flex items-baseline justify-between px-1 mb-1.5 gta-text-shadow">
          <span
            className="font-display font-extrabold uppercase tracking-[0.14em] text-[13px]"
            style={{ color: hud.districtColor }}
          >
            {hud.districtName}
          </span>
          <span className="font-mono-num text-[10px] text-slate-100/95 truncate max-w-[138px]">
            {hud.streetName}
          </span>
        </div>

        {/* Realistic Satellite GPS Rectangular Minimap Frame */}
        <div className="relative rounded-t-[6px] overflow-hidden border-[2px] border-b-0 border-[#0b0e18] ring-1 ring-white/15 shadow-[0_14px_36px_rgba(0,0,0,0.72)] bg-[#09243d]">
          <canvas
            ref={radarRef}
            width={264}
            height={154}
            className="block w-[264px] h-[154px]"
          />
          <div className="absolute top-1.5 left-2 px-1.5 py-0.5 rounded-[3px] bg-[#080c16]/75 font-mono-num text-[9px] font-bold text-white/95 flex items-center gap-1">
            <Compass className="w-2.5 h-2.5 text-[#00f0d8]" />
            {hud.clock}
          </div>
        </div>

        {/* 3 Fused Horizontal GTA VI Vitality Bars Directly Under Minimap: 50% Health · 25% Armor · 25% Focus */}
        <div className="grid grid-cols-12 gap-[2px] bg-[#090c14] p-[2px] rounded-b-[6px] border-[2px] border-t-0 border-[#0b0e18] shadow-[0_10px_24px_rgba(0,0,0,0.68)]">
          {/* Health Bar (50%) */}
          <div className="col-span-6 relative h-[9px] bg-[#162724] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-[#ff2e93]/80 transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, ghostHealthRef.current))}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-[#18e299] transition-all duration-100"
              style={{ width: `${Math.max(0, Math.min(100, hud.health))}%` }}
            />
          </div>

          {/* Armor Bar (25%) */}
          <div className="col-span-3 relative h-[9px] bg-[#142336] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-[#38bdf8] transition-all duration-150"
              style={{ width: `${Math.max(0, Math.min(100, hud.armor))}%` }}
            />
          </div>

          {/* Focus / Dead-Eye Bar (25%) */}
          <button
            type="button"
            tabIndex={-1}
            title="Toggle Focus Mode (Q)"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleFocus();
            }}
            className="pointer-events-auto cursor-pointer col-span-3 relative h-[9px] bg-[#241638] overflow-hidden"
          >
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-100 ${
                hud.focusActive ? 'bg-[#e879f9]' : 'bg-[#a855f7]'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, hud.focus))}%` }}
            />
          </button>
        </div>

        {/* Micro Bar Legend underneath */}
        <div className="mt-1 px-0.5 flex items-center justify-between text-[9px] font-mono-num text-slate-200/90 gta-text-shadow">
          <span className="flex items-center gap-1">
            <span className="text-[#18e299] font-bold">HP</span> {hud.health}
            <Shield className="w-2.5 h-2.5 text-[#38bdf8] ml-1.5" /> {hud.armor}
          </span>
          <span className="flex items-center gap-1 text-violet-200">
            <Sparkles className="w-2.5 h-2.5" /> FOCUS [Q] {hud.focus}%
          </span>
        </div>
      </div>

      {/* BOTTOM-RIGHT: Driving Telemetry + Dual Protagonist Switcher (Hidden cleanly when Smartphone is open) */}
      {!hud.phoneOpen && (
        <div className="absolute bottom-4 right-5 flex flex-col items-end gap-2">
          {/* Live Stunt / Drift Combo indicator */}
          {hud.inVehicle && (hud.driftScore > 5 || hud.airtime > 0.25) && (
            <div className="hud-surface-pink rounded-md px-3 py-1.5 text-right">
              <div className="font-display font-bold uppercase tracking-[0.16em] text-[11px] text-[#00f0d8]">
                {hud.airtime > 0.25 ? 'AIRTIME STUNT' : `DRIFT COMBO ×${hud.comboMult}`}
              </div>
              <div className="font-mono-num text-lg font-bold text-white leading-tight">
                {hud.airtime > 0.25 ? `${hud.airtime.toFixed(1)}s` : `${hud.driftScore} PTS`}
              </div>
            </div>
          )}

          {/* Sleek GTA VI Digital Driving Telemetry */}
          {hud.inVehicle && (
            <div className="gta-panel rounded-md px-3.5 py-2.5 w-[238px] flex flex-col gap-1.5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="font-display font-bold uppercase tracking-[0.12em] text-xs text-slate-300 truncate max-w-[130px]">
                    {hud.vehicleName}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono-num text-[32px] font-extrabold leading-none text-white">
                      {hud.vehicleSpeedKmh}
                    </span>
                    <span className="font-display text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      KM/H
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`inline-block px-2 py-0.5 rounded font-mono-num text-xs font-bold border ${
                      hud.vehicleBoosting
                        ? 'border-[#00f0d8] text-[#86fff3] bg-[#00f0d8]/20'
                        : 'border-[#ff2e93]/60 text-[#ff9bd0] bg-[#ff2e93]/15'
                    }`}
                  >
                    G{hud.vehicleGear}
                  </div>
                  <div className="mt-1 font-mono-num text-[10px] text-slate-400">
                    HULL {hud.vehicleHealthPct}%
                  </div>
                </div>
              </div>

              {/* Nitrous Bar */}
              <div>
                <div className="flex justify-between text-[9px] font-display uppercase tracking-[0.16em]">
                  <span className={hud.vehicleBoosting ? 'text-[#00f0d8] font-bold flex items-center gap-1' : 'text-slate-300 flex items-center gap-1'}>
                    <Zap className="w-2.5 h-2.5" />
                    NITROUS [SHIFT]
                  </span>
                  <span className="font-mono-num text-[#00f0d8]">T{hud.vehicleNitroTier}</span>
                </div>
                <div className="h-[6px] bg-white/10 rounded-sm overflow-hidden mt-0.5">
                  <div
                    className={`h-full transition-all duration-75 ${
                      hud.vehicleBoosting
                        ? 'bg-[#00f0d8]'
                        : 'bg-gradient-to-r from-[#ff2e93] to-[#00f0d8]'
                    }`}
                    style={{ width: `${Math.round(hud.vehicleNitro * 100)}%` }}
                  />
                </div>
              </div>

              {/* Radio Tuner Bar */}
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onNextRadio();
                }}
                className="pointer-events-auto cursor-pointer pt-1.5 border-t border-white/10 flex items-center justify-between gap-2 text-left hover:brightness-110"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Radio className="w-3 h-3 shrink-0" style={{ color: hud.radioAccent }} />
                  <span
                    className="font-display text-[11px] font-bold uppercase tracking-[0.12em] truncate"
                    style={{ color: hud.radioAccent }}
                  >
                    {hud.radioStation}
                  </span>
                </div>
                <span className="text-[10px] font-mono-num text-slate-400 shrink-0">[R]</span>
              </button>
            </div>
          )}

          {/* GTA VI Dual-Protagonist Character Switcher Badge */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onSwitchProtagonist();
            }}
            className="pointer-events-auto cursor-pointer gta-panel rounded-md px-3 py-1.5 flex items-center gap-2.5 hover:border-[#ff2e93]/70 transition-colors"
          >
            <div className="flex items-center gap-1.5 font-display text-xs font-extrabold uppercase tracking-[0.14em]">
              <span className={hud.protagonist === 'jason' ? 'text-[#00f0d8]' : 'text-slate-500'}>
                JASON
              </span>
              <span className="text-slate-600">/</span>
              <span className={hud.protagonist === 'lucia' ? 'text-[#ff2e93]' : 'text-slate-500'}>
                LUCIA
              </span>
            </div>
            <span className="h-3.5 w-[1px] bg-white/15" />
            <span className="font-mono-num text-[10px] text-slate-300">[G] SWITCH</span>
          </button>
        </div>
      )}

      {/* INTERACTIVE RADIAL WEAPON WHEEL (TAB) */}
      {hud.weaponWheelOpen && (
        <WeaponWheelOverlay
          weapons={hud.weaponsList}
          selectedIndex={hud.weaponIndex}
          onSelect={onSelectWeapon}
          onClose={onToggleWeaponWheel}
        />
      )}

      {/* INTERACTIVE VICE COAST SMARTPHONE (T) */}
      {hud.phoneOpen && (
        <ViceSmartphone
          hud={hud}
          onClose={() => onTogglePhone(false)}
          onTrackViceGram={onTrackViceGram}
          onFastTravel={onFastTravel}
          onCallCar={onCallCar}
          onSwitchProtagonist={onSwitchProtagonist}
          onSetWaypoint={onSetWaypoint}
        />
      )}
    </div>
  );
};
