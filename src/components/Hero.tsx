import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { FAST, SMOOTH, screenVariants } from '../motion';
import { useAppStore } from '../store';
import { PastePill } from './PastePill';
import { SkinDrop } from './SkinDrop';
import { UsernamePill } from './UsernamePill';

export function Hero() {
  const [loaded, setLoaded] = useState(false);
  const toast = useAppStore((s) => s.toast);
  const clearToast = useAppStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(clearToast, 2400);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => setLoaded(false), 1800);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  return (
    <m.main
      className="onload"
      variants={screenVariants}
      initial="hidden"
      animate="show"
      exit="out"
    >
      <div className="onload-stack">
        <m.img
          className="onload-logo"
          src="/logo.png"
          alt="BrandCraft"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SMOOTH}
        />
        <SkinDrop variant="cta" />
        <UsernamePill variant="hero" />
        <PastePill variant="hero" onLoaded={() => setLoaded(true)} />
        <AnimatePresence>
          {toast || loaded ? (
            <m.span
              key={toast || 'loaded'}
              className="toast"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={FAST}
            >
              {toast ?? 'preset loaded'}
            </m.span>
          ) : null}
        </AnimatePresence>
      </div>
    </m.main>
  );
}
