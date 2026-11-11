import { useId } from 'react';
import { m } from 'motion/react';
import { FAST } from '../motion';

interface Props {
  paramId: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

function formatValue(value: number, unit: string): string {
  const text = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  return unit ? `${text}${unit}` : text;
}

export function Slider({ paramId, label, value, min, max, step, unit, onChange }: Props) {
  const reactId = useId();
  const inputId = `${paramId}-${reactId}`;
  const span = max - min;
  const ratio = span > 0 ? Math.min(1, Math.max(0, (value - min) / span)) : 0;

  return (
    <div className="slider" data-param={paramId}>
      <div className="slider-head">
        <label className="slider-label" htmlFor={inputId}>
          {label}
        </label>
        {/* Remounting on each value gives a small tick; fixed width keeps it from reflowing. */}
        <span className="slider-value" data-value={value}>
          <m.span
            key={value}
            initial={{ opacity: 0.35, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={FAST}
          >
            {formatValue(value, unit)}
          </m.span>
        </span>
      </div>
      <div className="slider-track">
        {/* scaleX, not width: never a layout pass while dragging. */}
        <m.div
          className="slider-fill"
          initial={false}
          animate={{ scaleX: ratio }}
          transition={FAST}
        />
        <input
          id={inputId}
          className="slider-input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
