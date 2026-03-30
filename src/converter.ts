import {z} from 'zod/v4';
import mongoose, {SchemaDefinitionProperty} from 'mongoose';
import {mongooseRegistry} from './registry.js';
import {unwrapZodSchema} from './zod-helpers.js';

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
): ToMongooseType<T> {
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
      return objDef as any;
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

    const innerDef = element ? extractMongooseDef(element, visited) : mongoose.Schema.Types.Mixed;

    // If no explicit type override, wrap the inner definition in an array
    if (!mongooseProp.type) {
      const innerType = (innerDef as any).type || innerDef;
      // Special case: If innerType is Mixed because of z.any(), we should represent it clearly
      mongooseProp.type = [innerType];
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
      mongooseProp.type = mongoose.Schema.Types.Mixed;
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
    mongooseProp.type = mongoose.Schema.Types.Mixed;
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
  if (type === 'any' || type === 'unknown' || type === 'custom') {
    const cls = def.cls || (unwrapped as any).cls;
    if (cls === Buffer) {
      if (!mongooseProp.type) mongooseProp.type = mongoose.Schema.Types.Buffer;
    } else if (
      (cls?.name === 'ObjectId' || cls === mongoose.Types.ObjectId) &&
      !mongooseProp.type
    ) {
      mongooseProp.type = mongoose.Schema.Types.ObjectId;
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
    mongooseProp.type = mongoose.Schema.Types.Mixed;
  }

  return mongooseProp as any;
}

export function toMongooseSchema<T extends z.ZodTypeAny>(
  schema: T,
  options?: mongoose.SchemaOptions,
): mongoose.Schema<z.infer<T>> {
  const {schema: unwrapped} = unwrapZodSchema(schema);
  const meta =
    mongooseRegistry.get(schema) ||
    mongooseRegistry.get(unwrapped) ||
    (schema as any).meta?.() ||
    (unwrapped as any).meta?.() ||
    {};

  const mergedOptions = {
    ...options,
    ...(meta.timestamps ? {timestamps: meta.timestamps} : {}),
    ...(meta.discriminatorKey ? {discriminatorKey: meta.discriminatorKey} : {}),
  };
  const definition = extractMongooseDef(schema);
  return new mongoose.Schema<z.infer<T>>(definition as any, mergedOptions as any);
}
