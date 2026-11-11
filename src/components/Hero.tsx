import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { FAST, SMOOTH, screenVariants } from '../motion';
import { PastePill } from './PastePill';
import { SkinDrop } from './SkinDrop';

export function Hero() {
  const [loaded, setLoaded] = useState(false);

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
        <PastePill variant="hero" onLoaded={() => setLoaded(true)} />
        <AnimatePresence>
          {loaded ? (
            <m.span
              className="toast"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={FAST}
            >
              preset loaded
            </m.span>
          ) : null}
        </AnimatePresence>
      </div>
    </m.main>
  );
}
