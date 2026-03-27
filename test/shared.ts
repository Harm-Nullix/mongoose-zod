import * as utils from '../src/utils.js';
import M from 'mongoose';

export const getSchemaPlugins = (schema: M.Schema) => (schema as any).plugins.map(({fn}) => fn);
export const importModule = (id: string) => {
  const res = utils.tryImportModule(id, import.meta);
  if (res && typeof (res as any).then === 'function') {
    // Bun's dynamic import is async, we can't really wait here if called from sync tests.
    // However, the production code uses `await` so it's fine.
    // In tests, we prefer using `require` if possible.
    try {
      return require(id);
    } catch (e) {
      return undefined;
    }
  }
  return (res as any)?.module;
};
