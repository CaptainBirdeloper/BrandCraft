import { useId, useState } from 'react';
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
  const pctStr = `${(ratio * 100).toFixed(2)}%`;
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className={`slider${isDragging ? ' is-dragging' : ''}`} data-param={paramId}>
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
      <div className={`slider-track${isDragging ? ' is-dragging' : ''}`}>
        <div className="slider-gutter" />
        {/* Fill active bar with smooth width */}
        <div
          className="slider-fill"
          style={{ width: pctStr }}
        />
        {/* Floating value balloon above thumb */}
        <div
          className="slider-balloon"
          style={{ left: pctStr }}
        >
          {formatValue(value, unit)}
        </div>
        {/* Tactile thumb capsule */}
        <div
          className="slider-thumb"
          style={{ left: pctStr }}
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
          onPointerDown={() => setIsDragging(true)}
          onPointerUp={() => setIsDragging(false)}
          onPointerCancel={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          onTouchCancel={() => setIsDragging(false)}
        />
      </div>
    </div>
  );
}
