import { useEffect, useRef, useState, type FormEvent } from 'react';
import { m } from 'motion/react';
import { fetchSkinByUsername } from '../skin/fetchSkin';
import { useAppStore } from '../store';
import { UserIcon } from './icons';

interface UsernamePillProps {
  variant?: 'hero' | 'rail';
}

export function UsernamePill({ variant = 'hero' }: UsernamePillProps) {
  const setSkin = useAppStore((s) => s.setSkin);
  const showToast = useAppStore((s) => s.showToast);

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const target = username.trim();
    if (!target || loading) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(false);

    try {
      const { dataUrl, name } = await fetchSkinByUsername(target, controller.signal);
      if (controller.signal.aborted || !mountedRef.current) return;
      setSkin(dataUrl, name);
      if (mountedRef.current) setUsername('');
    } catch (err: unknown) {
      if (controller.signal.aborted || !mountedRef.current) return;
      setError(true);
      const msg = err instanceof Error ? err.message : 'Failed to fetch skin';
      showToast(msg);
    } finally {
      if (mountedRef.current && abortRef.current === controller) {
        setLoading(false);
      }
    }
  };

  return (
    <m.form
      className={`paste paste-${variant}${error ? ' paste-error' : ''}`}
      onSubmit={submit}
      animate={{ x: error ? [0, -4, 4, -4, 0] : 0 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
    >
      <UserIcon className="paste-icon" />
      <input
        className="paste-input"
        value={username}
        placeholder={loading ? 'fetching skin…' : 'enter username'}
        aria-label="Minecraft username"
        spellCheck={false}
        autoComplete="off"
        disabled={loading}
        onChange={(event) => {
          setUsername(event.target.value);
          if (error) setError(false);
        }}
      />
    </m.form>
  );
}
