'use strict';

var M = require('mongoose');
var zod = require('zod');

// src/zodInstances.service.ts
var zodInstanceofOriginalClasses = /* @__PURE__ */ new WeakMap();
var mongooseZodCustomType = (typeName, params) => {
  const instanceClass = typeName === "Buffer" ? Buffer : M.Types[typeName];
  const typeClass = M.Schema.Types[typeName];
  const result = zod.z.instanceof(instanceClass, params);
  zodInstanceofOriginalClasses.set(result._def.schema, typeClass);
  return result;
};

exports.mongooseZodCustomType = mongooseZodCustomType;
exports.zodInstanceofOriginalClasses = zodInstanceofOriginalClasses;
