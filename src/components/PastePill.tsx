import { useState, type FormEvent, type ClipboardEvent } from 'react';
import { m } from 'motion/react';
import { decodePreset } from '../preset/codec';
import { useAppStore } from '../store';
import { PasteIcon } from './icons';

interface PastePillProps {
  variant?: 'hero' | 'rail';
  onLoaded?: () => void;
}

export function PastePill({ variant = 'hero', onLoaded }: PastePillProps) {
  const setCustomPreset = useAppStore((s) => s.setCustomPreset);
  const setCodeError = useAppStore((s) => s.setCodeError);
  const codeError = useAppStore((s) => s.codeError);
  const [code, setCode] = useState('');

  const load = (raw: string): boolean => {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    const decoded = decodePreset(trimmed);
    if (!decoded) {
      setCodeError(true);
      return false;
    }
    setCustomPreset(decoded);
    setCode('');
    onLoaded?.();
    return true;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    load(code);
  };

  const paste = (event: ClipboardEvent<HTMLInputElement>) => {
    if (load(event.clipboardData.getData('text'))) event.preventDefault();
  };

  return (
    <m.form
      className={`paste paste-${variant}${codeError ? ' paste-error' : ''}`}
      onSubmit={submit}
      // A rejected code gets one short lateral jolt, never a loop.
      animate={{ x: codeError ? [0, -4, 4, -4, 0] : 0 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
    >
      <PasteIcon className="paste-icon" />
      <input
        className="paste-input"
        value={code}
        placeholder="paste code"
        aria-label="Preset code"
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => {
          setCode(event.target.value);
          if (codeError) setCodeError(false);
        }}
        onPaste={paste}
      />
    </m.form>
  );
}
