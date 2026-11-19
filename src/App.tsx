import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GameEngine,
  type BannerItem,
  type DialogueItem,
  type HudSnapshot,
  type ToastItem,
} from './game/GameEngine.ts';
import type { ShopModalState } from './game/economy/ShopsAndGarage.ts';
import type { WeatherMode } from './game/core/WeatherRules.ts';
import { TitleOverlay } from './components/TitleOverlay.tsx';
import { PlayingHud } from './components/PlayingHud.tsx';
import { DownedModal, PauseMapModal, ShopModal } from './components/Modals.tsx';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [banner, setBanner] = useState<BannerItem | null>(null);
  const [dialogue, setDialogue] = useState<DialogueItem | null>(null);
  const [moneyPop, setMoneyPop] = useState<{ id: number; amount: number } | null>(null);
  const [damageFlash, setDamageFlash] = useState(false);
  const [hitmarkerKey, setHitmarkerKey] = useState(0);
  const [shop, setShop] = useState<ShopModalState | null>(null);

  useEffect(() => {
    const el = canvasMountRef.current;
    if (!el) return;

    let moneyPopId = 1;
    let damageTimer = 0;
    let bannerTimer = 0;

    const engine = new GameEngine(el, {
      onHud: (snap) => setHud(snap),
      onToast: (t) => {
        setToasts((prev) => [...prev.slice(-2), t]);
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== t.id));
        }, 3200);
      },
      onBanner: (b) => {
        setBanner(b);
        window.clearTimeout(bannerTimer);
        bannerTimer = window.setTimeout(() => setBanner(null), 4200);
      },
      onDialogue: (d) => setDialogue(d),
      onMoneyPop: (amount) => {
        setMoneyPop({ id: moneyPopId++, amount });
      },
      onDamageFlash: () => {
        setDamageFlash(true);
        window.clearTimeout(damageTimer);
        damageTimer = window.setTimeout(() => setDamageFlash(false), 260);
      },
      onHitmarker: () => {
        setHitmarkerKey((k) => k + 1);
      },
      onShopChange: (s) => setShop(s),
    });

    engineRef.current = engine;
    return () => {
      window.clearTimeout(damageTimer);
      window.clearTimeout(bannerTimer);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleMountRadar = useCallback((canvas: HTMLCanvasElement | null) => {
    engineRef.current?.setRadarCanvas(canvas);
  }, []);

  const handleSelectWeather = useCallback((w: WeatherMode) => {
    engineRef.current?.setWeather(w);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070a11]">
      {/* Isolated permanent WebGL mount outside React HUD reconciliation */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {hud?.mode === 'title' && (
        <TitleOverlay
          hasSave={hud.hasSave}
          weather={hud.weather}
          onNewGame={() => engineRef.current?.startNewGame()}
          onContinue={() => engineRef.current?.continueGame()}
          onSelectWeather={handleSelectWeather}
        />
      )}

      {hud && hud.mode === 'playing' && (
        <PlayingHud
          hud={hud}
          toasts={toasts}
          banner={banner}
          dialogue={dialogue}
          moneyPop={moneyPop}
          damageFlash={damageFlash}
          hitmarkerKey={hitmarkerKey}
          onMountRadar={handleMountRadar}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onCycleWeather={() => engineRef.current?.cycleWeather()}
          onCycleCamera={() => engineRef.current?.cycleCamera()}
          onOpenPause={() => engineRef.current?.setPaused(true)}
          onNextRadio={() => engineRef.current?.nextRadio()}
          onSwitchProtagonist={() => engineRef.current?.switchProtagonist()}
          onToggleFocus={() => engineRef.current?.toggleFocus()}
          onToggleWeaponWheel={() => engineRef.current?.toggleWeaponWheel()}
          onSelectWeapon={(idx) => engineRef.current?.selectWeaponIndex(idx)}
          onTogglePhone={(open) => engineRef.current?.togglePhone(open)}
          onTrackViceGram={(postId) => engineRef.current?.trackViceGramPost(postId)}
          onFastTravel={(placeKey) => engineRef.current?.fastTravel(placeKey)}
          onCallCar={() => engineRef.current?.callPersonalCar()}
          onSetWaypoint={(x, z) => engineRef.current?.setWaypoint(x, z)}
        />
      )}

      {hud && hud.mode === 'paused' && (
        <PauseMapModal
          hud={hud}
          onResume={() => engineRef.current?.setPaused(false)}
          onRestart={() => engineRef.current?.startNewGame()}
          onTitle={() => engineRef.current?.returnToTitle()}
          onSetWaypoint={(x, z) => engineRef.current?.setWaypoint(x, z)}
          onClearWaypoint={() => engineRef.current?.clearWaypoint()}
          onFastTravel={(k) => engineRef.current?.fastTravel(k)}
          onCallCar={() => engineRef.current?.callPersonalCar()}
          onSetWeather={handleSelectWeather}
        />
      )}

      {shop && hud && (
        <ShopModal
          shop={shop}
          money={hud.money}
          onSelect={(id) => engineRef.current?.selectShopItem(id)}
          onClose={() => engineRef.current?.closeShop()}
        />
      )}

      {hud && hud.mode === 'gameover' && (
        <DownedModal
          hud={hud}
          onRecover={() => engineRef.current?.recoverFromDown()}
          onTitle={() => engineRef.current?.returnToTitle()}
        />
      )}
    </div>
  );
}
