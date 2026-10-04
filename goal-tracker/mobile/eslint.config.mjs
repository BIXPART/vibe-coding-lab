// ESLint flat config (ESLint 9).
//
// `eslint-config-expo` é o preset oficial do SDK e já traz as regras de
// React Native, `react-hooks` e `expo`. Este arquivo existe só para deixar a
// configuração explícita e versionada: o `expo lint` tentaria criá-la sozinho,
// mas no meio disso roda `npm install`, que falha com npm >= 12 (a CLI passa
// `--allow-scripts`, que o npm 12 rejeita em install de projeto).
//
// `expo lint` executa o ESLint usando este arquivo.

import expoConfig from 'eslint-config-expo/flat.js';

export default [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'web-build/**', 'android/**', 'ios/**'],
  },
];