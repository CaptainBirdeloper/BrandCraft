import type { Transition, Variants } from 'motion/react';

/**
 * Apple-style springs, described the way WWDC23 does: perceptual duration plus
 * bounce. One file so every surface shares the same four speeds and nothing in
 * the app invents its own curve.
 */
export const SMOOTH: Transition = { type: 'spring', visualDuration: 0.5, bounce: 0 };
export const SNAPPY: Transition = { type: 'spring', visualDuration: 0.35, bounce: 0.2 };
export const BOUNCY: Transition = { type: 'spring', visualDuration: 0.5, bounce: 0.25 };
export const FAST: Transition = { type: 'spring', visualDuration: 0.22, bounce: 0.1 };

/** Tap is the one place allowed to bounce hard; it lasts a single gesture. */
export const TAP_TRANSITION: Transition = { type: 'spring', visualDuration: 0.35, bounce: 0.55 };
export const TAP = { scale: 0.96 };

/** Cards land 35ms apart, so the eight of them read as one sweep, not a queue. */
export const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: SMOOTH },
};

/** Full-screen swap: the outgoing page fades, the incoming one settles. */
export const screenVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: FAST },
  out: { opacity: 0, transition: FAST },
};
