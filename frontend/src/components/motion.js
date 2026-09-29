import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

// Motion-enabled versions of the plain elements every "card" in the app is
// built from. Swap `div`/`Link`/`form`/`button`/`p`/`li` for these and
// spread `cardMotion` (or `cardMotionDelayed(index)` inside a list) onto
// them to get the same entrance + hover treatment everywhere, instead of
// every page hand-rolling its own animation.
export const MotionDiv = motion.div;
export const MotionLink = motion(Link);
export const MotionForm = motion.form;
export const MotionButton = motion.button;
export const MotionP = motion.p;
export const MotionLi = motion.li;

// Fades/slides a card in once as it scrolls into view (never re-triggers,
// so it doesn't replay every time you scroll past it), plus a gentle lift
// on hover. Use on any non-clickable card (div, form, p, li).
export const cardMotion = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.35, ease: 'easeOut' },
  whileHover: { y: -4 },
};

// Same as cardMotion, plus a small press-down effect - use on clickable
// cards (Link, button) so tapping them gives immediate feedback.
export const cardMotionTap = {
  ...cardMotion,
  whileTap: { scale: 0.98 },
};

// Same entrance as cardMotion but without the hover lift - for big content
// containers (a form, a multi-step panel) where "hovering" isn't a
// meaningful interaction and lifting the whole thing on mouseover would
// look like a glitch rather than a hover state.
export const sectionMotion = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.35, ease: 'easeOut' },
};

// For a grid/list of cards rendered from .map() - staggers each card's
// entrance by `step` seconds times its position, so they cascade in
// instead of all popping in at once. Pass the card's index.
export function cardMotionDelayed(index = 0, step = 0.06, tappable = false) {
  const base = tappable ? cardMotionTap : cardMotion;
  return { ...base, transition: { ...base.transition, delay: index * step } };
}
