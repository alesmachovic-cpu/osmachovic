// Flat config pre ESLint 9 + Next.js 16 + TypeScript.
// `next lint` bol v Next 16 odstránený — lint beží priamo cez `eslint`
// (viď package.json "lint": "eslint"). Tento config je vstupný bod.
//
// Skladá sa z dvoch flat-config arrays, ktoré dodáva eslint-config-next:
//   - core-web-vitals: base Next pravidlá + @next/next/* (a11y, web-vitals)
//   - typescript:      typescript-eslint "recommended" (non-type-checked,
//                      teda rýchle — bez parserOptions.project) + zmäkčené
//                      no-unused-vars / no-unused-expressions na "warn".
// typescript array zároveň nastavuje globálne ignores (.next, out, build,
// next-env.d.ts; node_modules a .git ignoruje ESLint sám).
//
// Cieľ je funkčný baseline, nie agresívne nové pravidlá — preto sa tu
// dodatočné rules zámerne nepridávajú.

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,

  // React Compiler diagnostiky (eslint-plugin-react-hooks v6) sú v Next 16
  // defaultne "error". Sú to štýlové odporúčania ("you might not need an
  // effect", immutability, ...), nie runtime bugy — a masívne označkujú
  // existujúci, funkčný kód. Aby `npm run lint` nebol blokovaný štýlom,
  // sú tu znížené na "warn": ostávajú viditeľné a postupne riešiteľné,
  // ale netvoria red baseline. (Klasické pravidlá ostávajú nedotknuté.)
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
    },
  },

  // Dve klasické pravidlá znížené na "warn" — nie sú to bugy ani bezpečnosť,
  // a v existujúcom kóde by inak tvorili red baseline:
  //   - no-unescaped-entities: apostrof/úvodzovka v JSX texte. React ich
  //     renderuje korektne (žiadny XSS) — v slovenských textoch je to len
  //     šum, nie chyba.
  //   - no-html-link-for-pages: jediný výskyt; ide o rýchlosť navigácie
  //     (<Link> vs <a>), nie o bug. Ostáva viditeľné ako warning.
  {
    rules: {
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
];

export default eslintConfig;
