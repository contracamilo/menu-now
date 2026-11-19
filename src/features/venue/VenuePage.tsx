import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/es';
import { supabase } from '../../lib/supabase';
import { IMAGE_ACCEPT, newImagePath, prepareImage, removeImage, uploadImage } from '../../lib/images';
import { publicImageUrl } from '../../lib/rest';
import { venueQueryKey, useVenue } from './useVenue';

const NAME_MAX = 60;

interface PendingLogo {
  blob: Blob;
  previewUrl: string;
}

/** «Mi local»: nombre (obligatorio) y logo (opcional) del local. */
export function VenuePage() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: venue } = useVenue();

  const [name, setName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [pendingLogo, setPendingLogo] = useState<PendingLogo | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [nameError, setNameError] = useState<MessageKey | null>(null);
  const [logoError, setLogoError] = useState<MessageKey | null>(null);
  const [status, setStatus] = useState<'saved' | 'error' | null>(null);

  // Rellena el formulario una sola vez con los datos guardados
  useEffect(() => {
    if (venue && !loaded) {
      setName(venue.name ?? '');
      setLoaded(true);
    }
  }, [venue, loaded]);

  useEffect(() => () => {
    if (pendingLogo) URL.revokeObjectURL(pendingLogo.previewUrl);
  }, [pendingLogo]);

  const save = useMutation({
    mutationFn: async () => {
      const previous = venue?.logo_path ?? null;
      let logoPath = removeLogo ? null : previous;
      if (pendingLogo) {
        logoPath = newImagePath('logo');
        await uploadImage(logoPath, pendingLogo.blob);
      }
      const { error } = await supabase
        .from('venue_settings')
        .update({ name: name.trim(), logo_path: logoPath })
        .eq('id', true);
      if (error) throw new Error(error.message);
      if (previous && previous !== logoPath) await removeImage(previous);
    },
    onSuccess: async () => {
      setPendingLogo(null);
      setRemoveLogo(false);
      setStatus('saved');
      await queryClient.invalidateQueries({ queryKey: venueQueryKey });
    },
    onError: () => setStatus('error'),
  });

  async function onLogoChange(file: File | undefined) {
    if (!file) return;
    setStatus(null);
    const result = await prepareImage(file, 'logo');
    if (result.error) {
      setLogoError(result.error); // el nombre escrito se conserva
      return;
    }
    setLogoError(null);
    setRemoveLogo(false);
    setPendingLogo({ blob: result.blob, previewUrl: URL.createObjectURL(result.blob) });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    const trimmed = name.trim();
    const error: MessageKey | null = !trimmed ? 'error.required' : trimmed.length > NAME_MAX ? 'error.tooLong' : null;
    setNameError(error);
    if (!error) save.mutate();
  }

  const currentLogo = pendingLogo?.previewUrl ?? (!removeLogo && venue?.logo_path ? publicImageUrl(venue.logo_path) : null);

  return (
    <main className="page">
      <h1>{t('admin.venue')}</h1>
      {venue && !venue.name && <p className="notice">{t('venue.missingName')}</p>}

      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="venue-name">{t('venue.name')}</label>
          <input
            id="venue-name"
            className="input"
            value={name}
            maxLength={NAME_MAX}
            required
            aria-invalid={nameError ? true : undefined}
            aria-describedby="venue-name-count venue-name-error"
            onChange={(e) => setName(e.target.value)}
          />
          <span id="venue-name-count" className="field__count">
            {t('form.charCount', { count: name.length, max: NAME_MAX })}
          </span>
          <span id="venue-name-error" className="message message--error">
            {nameError && t(nameError, { max: NAME_MAX })}
          </span>
        </div>

        <fieldset className="field">
          <legend>{t('venue.logo')}</legend>
          {currentLogo && <img className="image-preview image-preview--logo" src={currentLogo} alt="" />}
          <div className="field__actions">
            <label className="button tap-target file-button">
              {t(currentLogo ? 'venue.logoReplace' : 'venue.logoChoose')}
              <input
                type="file"
                className="visually-hidden"
                accept={IMAGE_ACCEPT}
                aria-describedby="venue-logo-error"
                onChange={(e) => {
                  void onLogoChange(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {currentLogo && (
              <button
                type="button"
                className="button tap-target"
                onClick={() => {
                  setPendingLogo(null);
                  setRemoveLogo(true);
                }}
              >
                {t('venue.logoRemove')}
              </button>
            )}
          </div>
          <span id="venue-logo-error" className="message message--error" role="alert">
            {logoError && t(logoError)}
          </span>
        </fieldset>

        <button type="submit" className="button tap-target button--primary" disabled={save.isPending}>
          {t('form.save')}
        </button>
        <p role="status" className={`message ${status === 'error' ? 'message--error' : 'message--success'}`}>
          {status === 'saved' && t('form.saved')}
          {status === 'error' && t('form.saveError')}
        </p>
      </form>
    </main>
  );
}
