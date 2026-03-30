import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import type {SchemaDefinition, SchemaDefinitionProperty, SchemaOptions} from 'mongoose';
import {mongooseRegistry} from './registry.js';
import {unwrapZodSchema} from './zod-helpers.js';

// Helper to get mongoose types safely without top-level import
const getMongoose = () => {
  try {
    // eslint-disable-next-line global-require
    return require('mongoose');
  } catch {
    return null;
  }
};

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
            : SchemaDefinitionProperty<any> & {[key: string]: any};

/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
export function extractMongooseDef<T extends z.ZodTypeAny>(
  schema: T,
  visited: Map<z.ZodTypeAny, any> = new Map(),
): ToMongooseType<T> & SchemaDefinitionProperty<any> {
  const {schema: unwrapped, features} = unwrapZodSchema(schema);

  // Pull any explicitly registered Mongoose metadata for the ORIGINAL schema instance
  // or any intermediate schemas if it's a chain of effects.
  const meta = mongooseRegistry.get(schema) || {};
  const unwrappedMeta = mongooseRegistry.get(unwrapped) || {};
  const mongooseProp: any = {...unwrappedMeta, ...meta};

  // If zObjectId() or similar were used, they might be wrapped in withMongoose again.
  // zObjectId returns withMongoose(z.custom(), {type: ObjectId}).
  // If we have nested metadata, we should prioritize the one that has a 'type' property.
  // Actually, unwrappedMeta should have the type if it came from zObjectId.
  // But if the user also used withMongoose(zObjectId(), {type: ...}), that should win.

  if (visited.has(unwrapped)) {
    const existing = visited.get(unwrapped);
    if (Object.keys(meta).length > 0) {
      Object.assign(existing, mongooseProp);
    }
    return existing as any;
  }

  // We must ensure recursive calls see the current object to break cycles.
  // We use mongooseProp for now, and if it's an object/array, we'll fill it.
  visited.set(unwrapped, mongooseProp);

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
  if (features.checks && Array.isArray(features.checks)) {
    for (const check of features.checks) {
      const traitSet = check._zod?.traits;
      const checkDef = check._zod?.def;
      if (!traitSet || !checkDef) continue;

      // String Lengths
      if (traitSet.has('$ZodCheckMinLength')) {
        mongooseProp.minlength = checkDef.minimum;
      }
      if (traitSet.has('$ZodCheckMaxLength')) {
        mongooseProp.maxlength = checkDef.maximum;
      }
      if (traitSet.has('$ZodCheckLengthEquals')) {
        mongooseProp.minlength = checkDef.length;
        mongooseProp.maxlength = checkDef.length;
      }

      // Numbers and Dates Comparisons
      if (traitSet.has('$ZodCheckGreaterThan')) {
        mongooseProp.min = checkDef.value;
      }
      if (traitSet.has('$ZodCheckLessThan')) {
        mongooseProp.max = checkDef.value;
      }

      // Regex / Match
      if (traitSet.has('$ZodCheckRegex')) {
        mongooseProp.match = checkDef.pattern;
      }

      // String Transforms (trim, lowercase, uppercase)
      if (traitSet.has('$ZodCheckOverwrite') && typeof checkDef.tx === 'function') {
        const txStr = checkDef.tx.toString();
        if (txStr.includes('.trim()')) {
          mongooseProp.trim = true;
        } else if (txStr.includes('.toLowerCase()')) {
          mongooseProp.lowercase = true;
        } else if (txStr.includes('.toUpperCase()')) {
          mongooseProp.uppercase = true;
        }
      }
    }
  }

  const def = (unwrapped as any)._def;
  if (!def) return mongooseProp;
  const {type} = def;

  // 1. Handle Objects (Recursion)
  if (type === 'object') {
    const {shape} = unwrapped as any;
    const objDef: any = {};

    // We must ensure recursive calls see the current object to break cycles.
    // If we have a type override, we use mongooseProp, otherwise we use objDef.
    const placeholder = mongooseProp.type ? mongooseProp : objDef;
    visited.set(unwrapped, placeholder);

    // eslint-disable-next-line no-restricted-syntax
    for (const key in shape) {
      if (!Object.prototype.hasOwnProperty.call(shape, key)) continue;
      objDef[key] = extractMongooseDef(shape[key], visited);
    }
    // If the developer didn't provide a strict Mongoose type override, return the shape
    if (!mongooseProp.type) {
      Object.assign(mongooseProp, objDef);
      // If we have any Mongoose-specific metadata besides the shape itself, return mongooseProp.
      // Otherwise return just the shape (objDef).
      // We exclude top-level only options from triggering the "metadata" flag for nested paths,
      // as they should be handled by toMongooseSchema.
      // We also exclude 'required' if it's explicitly set to false by our unwrap logic for objects.
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
      return (hasFieldMetadata ? mongooseProp : objDef) as any;
    }

    // If there is a type override, merge the object definition into the result
    Object.assign(mongooseProp, objDef);
  }

  // Handle Arrays, Sets and Tuples
  if (type === 'array' || type === 'set' || type === 'tuple') {
    const element =
      (unwrapped as any).element ||
      (unwrapped as any)._def.valueType ||
      (unwrapped as any)._def.rest ||
      (unwrapped as any)._def.items?.[0];

  const mongoose = getMongoose();
  const innerDef = element ? extractMongooseDef(element, visited) : (mongoose?.Schema.Types.Mixed || 'Mixed');

    // If no explicit type override, wrap the inner definition in an array
    if (!mongooseProp.type) {
      const innerType = (innerDef as any).type || innerDef;
      // Special case: If innerType is Mixed because of z.any(), we should represent it clearly
      mongooseProp.type = [innerType];

      // Transfer any metadata from the inner type (like 'ref') to the array definition
      if (typeof innerDef === 'object') {
        Object.assign(mongooseProp, innerDef);
        mongooseProp.type = [innerType]; // Restore type as array
      }
    }
  }

  // Handle Records and Maps
  if (type === 'record' || type === 'map') {
    const valueType = (unwrapped as any).valueSchema || (unwrapped as any)._def.valueType;
    if (!mongooseProp.type) {
      mongooseProp.type = Map;
      if (valueType) {
        const innerDef = extractMongooseDef(valueType, visited);
        mongooseProp.of = (innerDef as any).type || innerDef;
      }
    }
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
      type === 'discriminated_union' ||
      type === 'literal') &&
    !mongooseProp.type
  ) {
    mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
  }

  // Handle Primitives
  switch (type) {
    case 'string': {
      if (!mongooseProp.type) mongooseProp.type = String;
      if (mongooseProp.required !== false) mongooseProp.required = true;

      break;
    }
    case 'number': {
      if (!mongooseProp.type) mongooseProp.type = Number;
      if (mongooseProp.required !== false) mongooseProp.required = true;

      break;
    }
    case 'boolean': {
      if (!mongooseProp.type) mongooseProp.type = Boolean;
      if (mongooseProp.required !== false) mongooseProp.required = true;

      break;
    }
    case 'date': {
      if (!mongooseProp.type) mongooseProp.type = Date;
      if (mongooseProp.required !== false) mongooseProp.required = true;

      break;
    }
    case 'bigint': {
      if (!mongooseProp.type) {
        // Map BigInt to native BigInt if available
        mongooseProp.type = typeof BigInt === 'undefined' ? Number : BigInt;
      }
      if (mongooseProp.required !== false) mongooseProp.required = true;

      break;
    }
    default:
    // Do nothing
  }

  // Handle Enums
  if (type === 'enum') {
    if (!mongooseProp.type) mongooseProp.type = String;
    mongooseProp.enum = (unwrapped as any).options || def.values;
    if (mongooseProp.required !== false) mongooseProp.required = true;
  } else if (type === 'nativeenum' || type === 'native_enum') {
    if (!mongooseProp.type) mongooseProp.type = String;
    mongooseProp.enum = Object.values((unwrapped as any).enum || def.values);
    if (mongooseProp.required !== false) mongooseProp.required = true;
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
    // Re-call with the inner schema, passing the visited map to break cycles
    const result = extractMongooseDef(inner, visited);
    // If we have metadata, merge the lazy result into it
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

  return mongooseProp as any;
}

export function toMongooseSchema<T extends z.ZodTypeAny>(
  schema: T,
  options?: SchemaOptions,
): mongoose.Schema<z.infer<T>> {
  const {schema: unwrapped} = unwrapZodSchema(schema);
  const meta =
    mongooseRegistry.get(schema) ||
    mongooseRegistry.get(unwrapped) ||
    (schema as any).meta?.() ||
    (unwrapped as any).meta?.() ||
    {};

  const mergedOptions: SchemaOptions = {
    // Also merge other schema options from meta if they exist
    ...(meta.collection ? {collection: meta.collection} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.strict !== undefined ? {strict: meta.strict} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.id !== undefined ? {id: meta.id} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta._id !== undefined ? {_id: meta._id} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.minimize !== undefined ? {minimize: meta.minimize} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.validateBeforeSave !== undefined ? {validateBeforeSave: meta.validateBeforeSave} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.versionKey !== undefined ? {versionKey: meta.versionKey} : {}),
    ...(meta.timestamps ? {timestamps: meta.timestamps} : {}),
    ...(meta.discriminatorKey ? {discriminatorKey: meta.discriminatorKey} : {}),
    ...options,
  };
  const mongoose = getMongoose();
  if (!mongoose) {
    throw new Error('Mongoose must be installed to use toMongooseSchema');
  }
  const definition = extractMongooseDef(schema) as SchemaDefinition;
  return new mongoose.Schema(definition, mergedOptions) as any;
}
