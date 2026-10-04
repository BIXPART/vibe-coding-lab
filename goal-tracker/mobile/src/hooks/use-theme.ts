/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();

  // RN 0.88 removeu `'unspecified'` de `ColorSchemeName`: o valor de leitura é
  // só `'light' | 'dark'`. `null` só volta quando o módulo nativo Appearance
  // não existe (plataformas fora da árvore do RN) e, nesse caso, caímos no
  // light. Mesmo normalizador usado em `app/_layout.tsx`.
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
