import { useAppStore } from '../store';
import { ReplaceIcon, UploadIcon } from './icons';

const LABELS = { cta: 'Drop Skin', pill: 'Replace Skin' };

interface SkinDropProps {
  variant: 'cta' | 'pill';
}

/** File picker + drag target for the skin image. Both upload surfaces share it. */
export function SkinDrop({ variant }: SkinDropProps) {
  const setSkin = useAppStore((s) => s.setSkin);

  const load = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setSkin(reader.result, file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <label
      className={variant === 'cta' ? 'cta' : 'pill pill-replace'}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        load(event.dataTransfer.files[0]);
      }}
    >
      <input
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          load(file);
        }}
      />
      {LABELS[variant]}
      {variant === 'cta' ? (
        <UploadIcon className="cta-icon" />
      ) : (
        <ReplaceIcon className="pill-icon" />
      )}
    </label>
  );
}
