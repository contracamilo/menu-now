import { useContext } from 'react';
import { I18nContext, type I18nValue } from './I18nProvider';

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n debe usarse dentro de <I18nProvider>');
  return value;
}

export function useT() {
  return useI18n().t;
}
