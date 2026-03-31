// Helper to get mongoose instance safely
export const getMongoose = () => {
  try {
    // eslint-disable-next-line global-require
    const m = require('mongoose');
    if (m && (m.Schema || m.default?.Schema)) {
      return m.default || m;
    }
    return m;
  } catch {
    // Try to see if mongoose is globally available (e.g. in some environments)
    if ((globalThis as any).mongoose) {
      return (globalThis as any).mongoose;
    }
    return null;
  }
};

let isFrontend = false;

/**
 * Enable or disable frontend mode.
 * In frontend mode, specialized types like ObjectId and Buffer fall back to
 * simpler representations (strings/arrays) and do not depend on Mongoose.
 */
export const setFrontendMode = (enabled: boolean) => {
  isFrontend = enabled;
};

export const getFrontendMode = () => {
  // Try to auto-detect if not explicitly set
  // This is a simple heuristic: check for window/document
  if (isFrontend === undefined || isFrontend === null) {
    return (globalThis as any).window !== undefined && (globalThis as any).document !== undefined;
  }
  return isFrontend;
};
