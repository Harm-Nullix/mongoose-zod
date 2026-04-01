import {z} from 'zod/v4';
import {getMongoose} from './config.js';
import {unwrapZodSchema} from './zod-helpers.js';
import {mongooseRegistry} from './registry.js';
import {mapZodChecksToMongoose} from './validation-mappers.js';
import {handleObject, handleArray, handleRecord} from './schema-handlers.js';
import {callHookSync} from './hooks.js';

/**
 * Type-level mapping from Zod to Mongoose Schema Definitions
 */
export type ToMongooseType<T extends z.ZodTypeAny> =
  T extends z.ZodObject<infer Shape>
    ? {[K in keyof Shape]: Shape[K] extends z.ZodTypeAny ? ToMongooseType<Shape[K]> : any}
    : T extends z.ZodArray<infer Element>
      ? Element extends z.ZodTypeAny
        ? Array<ToMongooseType<Element>> | {type: Array<any>; [key: string]: any}
        : Array<any>
      : T extends z.ZodOptional<infer Inner>
        ? Inner extends z.ZodTypeAny
          ? ToMongooseType<Inner>
          : any
        : T extends z.ZodDefault<infer Inner>
          ? Inner extends z.ZodTypeAny
            ? ToMongooseType<Inner>
            : any
          : T extends z.ZodNullable<infer Inner>
            ? Inner extends z.ZodTypeAny
              ? ToMongooseType<Inner>
              : any
            : any;

/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
export function extractMongooseDef<T extends z.ZodTypeAny>(
  schema: T,
  visited: Map<z.ZodTypeAny, any> = new Map(),
): ToMongooseType<T> & Record<string, any> {
  // Only call converter:before at the very beginning of a run
  if (visited.size === 0) {
    callHookSync('converter:before', {schema: schema as z.ZodTypeAny, visited});
  }
  callHookSync('converter:start', {schema: schema as z.ZodTypeAny, visited});

  const {schema: unwrapped, features} = unwrapZodSchema(schema);

  // Pull any explicitly registered Mongoose metadata
  callHookSync('registry:get:before', {schema: schema as z.ZodTypeAny});
  const meta = mongooseRegistry.get(schema) || {};
  callHookSync('registry:get', {schema: schema as z.ZodTypeAny, meta});

  callHookSync('registry:get:before', {schema: unwrapped});
  const unwrappedMeta = mongooseRegistry.get(unwrapped) || {};
  callHookSync('registry:get', {schema: unwrapped, meta: unwrappedMeta});

  // If we have a chain of wrappers, collect metadata from all of them.
  let currentMeta = {...unwrappedMeta, ...meta};
  if ((schema as any)._def.innerType) {
    let inner = (schema as any)._def.innerType;
    while (inner) {
      callHookSync('registry:get:before', {schema: inner});
      const innerMeta = mongooseRegistry.get(inner);
      callHookSync('registry:get', {schema: inner, meta: innerMeta});

      if (innerMeta) {
        currentMeta = {...innerMeta, ...currentMeta};
      }
      inner = inner._def?.innerType || inner._def?.schema;
    }
  }
  const mongooseProp: any = currentMeta;

  callHookSync('converter:unwrapped', {
    schema: schema as z.ZodTypeAny,
    unwrapped,
    features,
    meta: currentMeta,
    mongooseProp: mongooseProp as any,
  });

  if (features.isOptional === true && mongooseProp.type && mongooseProp.required !== true) {
    mongooseProp.required = false;
  }

  if (visited.has(unwrapped)) {
    const existing = visited.get(unwrapped);
    if (existing === mongooseProp) {
       return existing as any;
    }
    // console.log('Visited CACHE for', (unwrapped as any)._def.type, existing);
    if (Object.keys(meta).length > 0) {
      Object.assign(existing, mongooseProp);
    }
    return existing as any;
  }

  visited.set(unwrapped, mongooseProp);
  // console.log('Visited set for', (unwrapped as any)._def.type, mongooseProp);

  if (features.default !== undefined) {
    mongooseProp.default = features.default;
  }
  if (features.required === false) {
    mongooseProp.required = false;
  }
  if (features.readOnly === true) {
    mongooseProp.readOnly = true;
  }

  // Map Zod checks to Mongoose options
  mapZodChecksToMongoose(features.checks, mongooseProp);

  const def = (unwrapped as any)._def;
  if (!def) {
    callHookSync('converter:after', {
      schema: schema as z.ZodTypeAny,
      mongooseProp,
    });
    return mongooseProp;
  }
  const {type} = def;

  callHookSync('converter:node', {
    schema: unwrapped,
    mongooseProp,
    type,
  });

  // Handle recursion and specific types via separate handlers
  if (type === 'object') {
    const result = handleObject(unwrapped as any, mongooseProp, visited, extractMongooseDef as any);
    callHookSync('converter:after', {
      schema: schema as z.ZodTypeAny,
      mongooseProp: result,
    });
    if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
      delete result.includeId;
    }
    return result;
  }

  if (type === 'array' || type === 'set' || type === 'tuple') {
    handleArray(unwrapped as any, mongooseProp, visited, extractMongooseDef as any);
  }

  if (type === 'record' || type === 'map') {
    handleRecord(unwrapped as any, mongooseProp, visited, extractMongooseDef as any);
  }

  // Handle Intersections
  if (type === 'intersection') {
    const left = extractMongooseDef((unwrapped as any)._def.left, visited);
    const right = extractMongooseDef((unwrapped as any)._def.right, visited);

    if (typeof left === 'object' && typeof right === 'object') {
      Object.assign(mongooseProp, left, right);
    } else if (!mongooseProp.type) {
      mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
    }
  }

  // Handle Unions
  if (
    (type === 'union' ||
      type === 'discriminatedunion' ||
      type === 'discriminated_union') &&
    !mongooseProp.type
  ) {
    const mongoose = getMongoose();
    // We only map simple primitive unions to Mongoose Union by default to avoid complexity
    const options = (unwrapped as any).options || (unwrapped as any)._def.options;
    const unionCtx = {
      isSimpleUnion: false,
      isObjectUnion: false,
    };

    if (Array.isArray(options) && options.length > 0) {
      unionCtx.isSimpleUnion = options.every((opt) => {
        const {type} = unwrapZodSchema(opt).schema._def;
        return ['string', 'number', 'boolean', 'date', 'bigint', 'literal'].includes(type);
      });

      unionCtx.isObjectUnion = options.every((opt) => {
        const {type} = unwrapZodSchema(opt).schema._def;
        return type === 'object';
      });
    }

    callHookSync('schema:union:before', {schema: unwrapped as any, mongooseProp, ctx: unionCtx});

    if (mongoose?.Schema.Types.Union && unionCtx.isSimpleUnion && options.length > 0) {
      mongooseProp.type = mongoose.Schema.Types.Union;
      mongooseProp.of = options.map((opt: any) => {
        const def = extractMongooseDef(opt, visited);
        return (def as any).type || (def as any);
      });
    } else if (unionCtx.isObjectUnion && options.length > 0) {
      // Merge all object properties into a single schema object
      // This is a common pattern for Discriminated Unions in Mongoose when not using actual Discriminators
      const mergedDef: any = {};
      for (const opt of options) {
        // Use a clean visited map for each branch to avoid cross-pollination of properties
        const def = extractMongooseDef(opt, new Map());
        if (typeof def === 'object' && def !== null) {
          // Recursively merge objects to handle overlaps
          for (const key in def) {
            let prop = def[key];
            
            // Make all properties optional in the merged schema to allow any union member
            if (typeof prop === 'object' && prop !== null && !Array.isArray(prop)) {
              prop.required = false;
            }

            if (mergedDef[key] && typeof mergedDef[key] === 'object' && typeof prop === 'object' && !Array.isArray(mergedDef[key]) && !Array.isArray(prop)) {
               // If both are objects, merge their fields
               // IMPORTANT: If one has a specific type and the other is Mixed, prefer the specific type
               const existingType = mergedDef[key].type || mergedDef[key].instance || (typeof mergedDef[key] === 'function' ? mergedDef[key] : null);
               const newType = prop.type || prop.instance || (typeof prop === 'function' ? prop : null);

               const isMixed = (t: any) =>
                  t === 'Mixed' ||
                  t?.name === 'Mixed' ||
                  t?.instance === 'Mixed' ||
                  t?.name === 'SchemaMixed' ||
                  (getMongoose()?.Schema.Types.Mixed && t === getMongoose()?.Schema.Types.Mixed);

               if (isMixed(existingType) && !isMixed(newType)) {
                  // If existing is Mixed but new is specific, replace
                  mergedDef[key] = prop;
               } else if (!isMixed(existingType) && isMixed(newType)) {
                  // Keep existing
               } else {
                  Object.assign(mergedDef[key], prop);
               }
            } else if (mergedDef[key] && (typeof mergedDef[key] !== 'object' || Array.isArray(mergedDef[key])) && typeof prop === 'object' && !Array.isArray(prop)) {
               // If existing is primitive but new is object, prefer object (more specific)
               mergedDef[key] = prop;
            } else if (mergedDef[key] && typeof mergedDef[key] === 'object' && !Array.isArray(mergedDef[key]) && (typeof prop !== 'object' || Array.isArray(prop))) {
               // If existing is object but new is primitive, keep object
            } else if (!mergedDef[key]) {
               // New property
               mergedDef[key] = prop;
            }
          }
        }
      }
      // Since it's an object union, we merge it directly into mongooseProp
      // but only if we are at the top level of this node.
      if (!mongooseProp.type || mongooseProp.type === (getMongoose()?.Schema.Types.Mixed || 'Mixed')) {
         delete mongooseProp.type;
      }
      Object.assign(mongooseProp, mergedDef);
    } else {
      mongooseProp.type = mongoose?.Schema.Types.Mixed || 'Mixed';
    }

    callHookSync('schema:union:after', {schema: unwrapped as any, mongooseProp, ctx: unionCtx});
  }

  if (type === 'literal' && !mongooseProp.type) {
    mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
  }

  // Handle Primitives
  switch (type) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'date':
    case 'bigint': {
      if (!mongooseProp.type) {
        if (type === 'bigint') {
          mongooseProp.type = typeof BigInt === 'undefined' ? Number : BigInt;
        } else {
          const typeMap: Record<string, any> = {
            string: String,
            number: Number,
            boolean: Boolean,
            date: Date,
          };
          mongooseProp.type = typeMap[type];
        }
      }
      if (mongooseProp.required !== false) mongooseProp.required = true;
      break;
    }
    case 'enum':
    case 'nativeenum':
    case 'native_enum': {
      if (!mongooseProp.type) mongooseProp.type = String;
      mongooseProp.enum =
        type === 'enum'
          ? (unwrapped as any).options || def.values
          : Object.values((unwrapped as any).enum || def.values);
      if (mongooseProp.required !== false) mongooseProp.required = true;
      break;
    }
    default:
    // Do nothing
  }

  // Handle Specialized Types (Buffer, ObjectId)
  const mongooseInstance = getMongoose();
  if (type === 'any' || type === 'unknown' || type === 'custom') {
    const cls = def.cls || (unwrapped as any).cls;
    if (cls === Buffer || (typeof Uint8Array !== 'undefined' && cls === Uint8Array)) {
      if (!mongooseProp.type) mongooseProp.type = mongooseInstance?.Schema.Types.Buffer || 'Buffer';
    } else if (
      (cls?.name === 'ObjectId' || (mongooseInstance && cls === mongooseInstance.Types.ObjectId)) &&
      !mongooseProp.type
    ) {
      mongooseProp.type = mongooseInstance?.Schema.Types.ObjectId || 'ObjectId';
    }
  }

  // Handle Lazy (Recursion Support)
  if (type === 'lazy') {
    const inner = def.getter();
    const result = extractMongooseDef(inner, visited);
    if (Object.keys(meta).length > 0 && result !== mongooseProp) {
      if (typeof result === 'object' && !Array.isArray(result)) {
        Object.assign(mongooseProp, result);
      } else {
        mongooseProp.type = (result as any).type || result;
      }
      return mongooseProp as any;
    }
    return result as any;
  }

  // Fallback for z.any() or unhandled types
  if (!mongooseProp.type && type !== 'object') {
    mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
  }

  callHookSync('converter:after', {
    schema: schema as z.ZodTypeAny,
    mongooseProp,
  });

  if (typeof mongooseProp === 'object' && mongooseProp !== null && !Array.isArray(mongooseProp)) {
    delete mongooseProp.includeId;
  }

  return mongooseProp;
}
