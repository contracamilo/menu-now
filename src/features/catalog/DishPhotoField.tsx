import { useEffect, useState } from 'react';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/es';
import { IMAGE_ACCEPT, prepareImage } from '../../lib/images';
import { publicImageUrl } from '../../lib/rest';

export interface PhotoState {
  /** Foto guardada (ruta en el bucket). */
  current: string | null;
  /** Foto nueva ya redimensionada, pendiente de subir al guardar. */
  pending: { blob: Blob; previewUrl: string } | null;
  /** El dueño ha quitado la foto guardada. */
  removed: boolean;
}

/** Elegir, cambiar o quitar la foto del plato. Un archivo inválido no toca el resto del formulario. */
export function DishPhotoField({ value, onChange }: { value: PhotoState; onChange: (value: PhotoState) => void }) {
  const t = useT();
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    const url = value.pending?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [value.pending]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const result = await prepareImage(file, 'dish');
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    onChange({ ...value, pending: { blob: result.blob, previewUrl: URL.createObjectURL(result.blob) }, removed: false });
  }

  const preview = value.pending?.previewUrl ?? (!value.removed && value.current ? publicImageUrl(value.current) : null);

  return (
    <fieldset className="field">
      <legend>{t('form.photo')}</legend>
      {preview && <img className="image-preview image-preview--dish" src={preview} alt="" />}
      <div className="field__actions">
        <label className="button tap-target file-button">
          {t(preview ? 'form.photoReplace' : 'form.photoChoose')}
          <input
            type="file"
            className="visually-hidden"
            accept={IMAGE_ACCEPT}
            aria-describedby="dish-photo-error"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {preview && (
          <button type="button" className="button tap-target" onClick={() => onChange({ ...value, pending: null, removed: true })}>
            {t('form.photoRemove')}
          </button>
        )}
      </div>
      <span id="dish-photo-error" role="alert" className="message message--error">
        {error && t(error)}
      </span>
    </fieldset>
  );
}
