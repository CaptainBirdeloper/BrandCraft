import { useAppStore } from '../store';
import { HalftoneIcon } from './icons';

interface HalftoneToggleProps {
  variant?: 'hero' | 'rail';
}

export function HalftoneToggle({ variant = 'rail' }: HalftoneToggleProps) {
  const slots = useAppStore((s) => s.slots);
  const toggleHalftone = useAppStore((s) => s.toggleHalftone);
  const isHalftoneOn = slots.some((s) => s.variant.backdrop.style === 'riso');

  return (
    <button
      type="button"
      className={`paste paste-${variant} halftone-toggle${isHalftoneOn ? ' is-active' : ''}`}
      onClick={toggleHalftone}
      aria-label={`Toggle halftone patterns (${isHalftoneOn ? 'enabled' : 'disabled'})`}
      aria-pressed={isHalftoneOn}
      title={isHalftoneOn ? 'Disable halftone patterns across PFPs and Banners' : 'Enable halftone patterns across PFPs and Banners'}
    >
      <HalftoneIcon className="paste-icon halftone-icon" />
      <span className="paste-input halftone-label">
        {isHalftoneOn ? 'halftone on' : 'halftone off'}
      </span>
    </button>
  );
}
