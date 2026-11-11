import { useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { decodePreset } from './preset/codec';
import { DownloadScreen } from './components/DownloadScreen';
import { EditScreen } from './edit/EditScreen';
import { Editor } from './components/Editor';
import { Hero } from './components/Hero';
import { useAppStore } from './store';

export default function App() {
  const skinUrl = useAppStore((s) => s.skinUrl);
  const screen = useAppStore((s) => s.screen);
  const editDraft = useAppStore((s) => s.editDraft);
  const setCustomPreset = useAppStore((s) => s.setCustomPreset);
  const setCodeError = useAppStore((s) => s.setCodeError);

  useEffect(() => {
    if (!window.location.hash.startsWith('#c=')) return;
    const decoded = decodePreset(decodeURIComponent(window.location.hash.slice(3)));
    if (decoded) setCustomPreset(decoded);
    else setCodeError(true);
  }, [setCustomPreset, setCodeError]);

  // Pages overlap instead of waiting on each other: the drop feels instant.
  return (
    <AnimatePresence initial={false}>
      {!skinUrl ? (
        <Hero key="hero" />
      ) : screen === 'download' ? (
        <DownloadScreen key="download" />
      ) : screen === 'edit' && editDraft ? (
        <EditScreen key="edit" />
      ) : (
        <Editor key="editor" />
      )}
    </AnimatePresence>
  );
}
