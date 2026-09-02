import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Catalog imagery is extracted once, resized, and encoded as WebP. Native
    // <img> keeps those curated crops stable in both Next.js and Vinext builds.
    rules: { '@next/next/no-img-element': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'dist-api/**', 'next-env.d.ts']),
]);

export default eslintConfig;
