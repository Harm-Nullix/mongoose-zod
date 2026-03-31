import {z} from 'zod/v4';
import {mongooseRegistry} from './registry.js';
import {unwrapZodSchema} from './zod-helpers.js';
import {getMongoose} from './config.js';

/**
 * Handles ZodObject conversion to Mongoose Schema definition.
 */
export function handleObject(
  unwrapped: z.ZodObject<any>,
  mongooseProp: any,
  visited: Map<z.ZodTypeAny, any>,
  extractMongooseDef: (schema: z.ZodTypeAny, visited: Map<z.ZodTypeAny, any>) => any,
) {
  const {shape} = unwrapped;
  const objDef: any = {};

  // We must ensure recursive calls see the current object to break cycles.
  const placeholder = mongooseProp.type ? mongooseProp : objDef;
  visited.set(unwrapped, placeholder);

  // eslint-disable-next-line no-restricted-syntax
  for (const key in shape) {
    if (!Object.prototype.hasOwnProperty.call(shape, key)) continue;

    // Skip automatic _id mapping unless explicitly requested
    if (key === '_id') {
      const idMeta = mongooseRegistry.get(shape[key]) || {};
      const unwrappedId = unwrapZodSchema(shape[key]).schema;
      const unwrappedIdMeta = mongooseRegistry.get(unwrappedId) || {};
      if (idMeta.includeId !== true && unwrappedIdMeta.includeId !== true) continue;
    }
    objDef[key] = extractMongooseDef(shape[key], visited);
  }

  // If the developer didn't provide a strict Mongoose type override, return the shape
  if (!mongooseProp.type) {
    Object.assign(mongooseProp, objDef);

    const topLevelOptions = new Set([
      'collection',
      'versionKey',
      'timestamps',
      'discriminatorKey',
      'strict',
      'id',
      '_id',
      'minimize',
      'validateBeforeSave',
    ]);

    const hasFieldMetadata = Object.keys(mongooseProp).some((k) => {
      if (Object.prototype.hasOwnProperty.call(objDef, k)) return false;
      if (topLevelOptions.has(k)) return false;
      if (k === 'required' && mongooseProp[k] === false) return false;
      return true;
    });

    return hasFieldMetadata ? mongooseProp : objDef;
  }

  // If there is a type override, merge the object definition into the result
  Object.assign(mongooseProp, objDef);
  return mongooseProp;
}

/**
 * Handles ZodArray, ZodSet, and ZodTuple conversion.
 */
export function handleArray(
  unwrapped: z.ZodArray<any> | z.ZodSet<any> | z.ZodTuple<any>,
  mongooseProp: any,
  visited: Map<z.ZodTypeAny, any>,
  extractMongooseDef: (schema: z.ZodTypeAny, visited: Map<z.ZodTypeAny, any>) => any,
) {
  const element =
    (unwrapped as any).element ||
    (unwrapped as any)._def.valueType ||
    (unwrapped as any)._def.rest ||
    (unwrapped as any)._def.items?.[0];

  const mongoose = getMongoose();
  const innerDef = element
    ? extractMongooseDef(element, visited)
    : mongoose?.Schema.Types.Mixed || 'Mixed';

  // If no explicit type override, wrap the inner definition in an array
  if (!mongooseProp.type) {
    const innerType = (innerDef as any).type || innerDef;
    mongooseProp.type = [innerType];

    // Transfer any metadata from the inner type (like 'ref') to the array definition
    if (typeof innerDef === 'object') {
      Object.assign(mongooseProp, innerDef);
      mongooseProp.type = [innerType]; // Restore type as array
    }
  }
}

/**
 * Handles ZodRecord and ZodMap conversion.
 */
export function handleRecord(
  unwrapped: z.ZodRecord<any, any> | z.ZodMap<any, any>,
  mongooseProp: any,
  visited: Map<z.ZodTypeAny, any>,
  extractMongooseDef: (schema: z.ZodTypeAny, visited: Map<z.ZodTypeAny, any>) => any,
) {
  const valueType =
    (unwrapped as any).valueType ||
    (unwrapped as any).valueSchema ||
    (unwrapped as any)._def.valueType ||
    (unwrapped as any)._def.valueSchema ||
    (unwrapped as any)._def.innerType; // For some Zod versions
  if (!mongooseProp.type || mongooseProp.type === Map) {
    mongooseProp.type = Map;
    const finalValueType = valueType || (unwrapped as any).valueSchema || (unwrapped as any)._def?.valueSchema;
    if (finalValueType) {
      const innerDef = extractMongooseDef(finalValueType, visited);
      mongooseProp.of = (innerDef as any).type || innerDef;
    }
  }
}
