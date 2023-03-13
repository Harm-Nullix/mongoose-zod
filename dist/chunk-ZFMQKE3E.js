import M from 'mongoose';
import { z } from 'zod';

// src/zodInstances.service.ts
var zodInstanceofOriginalClasses = /* @__PURE__ */ new WeakMap();
var mongooseZodCustomType = (typeName, params) => {
  const instanceClass = typeName === "Buffer" ? Buffer : M.Types[typeName];
  const typeClass = M.Schema.Types[typeName];
  const result = z.instanceof(instanceClass, params);
  zodInstanceofOriginalClasses.set(result._def.schema, typeClass);
  return result;
};

export { mongooseZodCustomType, zodInstanceofOriginalClasses };
