/**
 * `useColorScheme` com guarda de hidratação para web.
 *
 * A versão estática (SSR) é gerada sem saber a preferência do sistema, então o
 * primeiro render no servidor e o primeiro no cliente divergiriam e o React
 * descartaria a árvore. O marcador `hasHydrated` força o servidor a devolver
 * `'light'` e deixa o cliente assumir o valor real.
 *
 * O `setState` dentro do efeito é o ponto: trocar `useState` por uma Promessa
 * hydrated (React 18+) seria a solução idiomática, mas exigiria `Suspense` no
 * layout raiz — e o ganho é nulo aqui. O custo é um render extra no primeiro
 * carregamento web. Por isso a regra `set-state-in-effect` é desativada só
 * neste ponto, com o motivo registrado.
 */
/* eslint-disable react-hooks/set-state-in-effect -- marcador de hidratação web; ver comentário acima. */
import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}