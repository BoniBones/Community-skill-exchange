import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
        for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
          const candidateUrl = new URL(specifier + ext, context.parentURL);
          if (existsSync(fileURLToPath(candidateUrl))) {
            return nextResolve(pathToFileURL(fileURLToPath(candidateUrl)).href, context);
          }
        }
      }
      throw err;
    }
  },
});
