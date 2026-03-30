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
    return globalThis.window !== undefined && globalThis.document !== undefined;
  }
  return isFrontend;
};
