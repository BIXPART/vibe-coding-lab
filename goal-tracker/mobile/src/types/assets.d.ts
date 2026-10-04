/**
 * Declarações de módulos não-JavaScript.
 *
 * O SDK 57 dá suporte a CSS no Metro (`import '@/global.css'`), mas o TypeScript
 * não conhece essa importação. Sem este arquivo, `tsc --noEmit` falha com
 * TS2882 em qualquer lugar que importe `src/constants/theme`.
 *
 * É uma declaração de módulo nativo — nada de dependência, nada de shim.
 */
declare module '*.css' {
  const content: string;
  export default content;
}