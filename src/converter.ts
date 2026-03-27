import {z} from 'zod/v4';
import mongoose, {SchemaDefinitionProperty} from 'mongoose';
import {mongooseRegistry} from './registry.js';
import {unwrapZodSchema} from './zod-helpers.js';

/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
export function extractMongooseDef(schema: z.ZodTypeAny): SchemaDefinitionProperty<any> {
  const {schema: unwrapped, features} = unwrapZodSchema(schema);

  // Pull any explicitly registered Mongoose metadata for the ORIGINAL schema instance
  // or any intermediate schemas if it's a chain of effects.
  const meta = mongooseRegistry.get(schema) || mongooseRegistry.get(unwrapped) || {};
  const mongooseProp: any = {...meta};

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
    // eslint-disable-next-line no-restricted-syntax
    for (const key in shape) {
      if (!Object.prototype.hasOwnProperty.call(shape, key)) continue;
      objDef[key] = extractMongooseDef(shape[key]);
    }
    // If the developer didn't provide a strict Mongoose type override, return the shape
    if (!mongooseProp.type) return objDef;
  }

  // 2. Handle Arrays
  if (type === 'array') {
    const innerDef = extractMongooseDef((unwrapped as any).element);
    // If no explicit type override, wrap the inner definition in an array
    if (!mongooseProp.type) {
      mongooseProp.type = [(innerDef as any).type || innerDef];
    }
  }

  // 3. Handle Primitives
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

  // 4. Handle Enums
  if (type === 'enum') {
    if (!mongooseProp.type) mongooseProp.type = String;
    mongooseProp.enum = (unwrapped as any).options || def.values;
    if (mongooseProp.required !== false) mongooseProp.required = true;
  } else if (type === 'nativeenum' || type === 'native_enum') {
    if (!mongooseProp.type) mongooseProp.type = String;
    mongooseProp.enum = Object.values((unwrapped as any).enum || def.values);
    if (mongooseProp.required !== false) mongooseProp.required = true;
  }

  // 5. Handle Specialized Types (Buffer, ObjectId)
  if (type === 'any' || type === 'unknown' || type === 'custom') {
    const cls = def.cls || (unwrapped as any).cls;
    if (cls === Buffer) {
      if (!mongooseProp.type) mongooseProp.type = mongoose.Schema.Types.Buffer;
    } else if (cls?.name === 'ObjectId' && !mongooseProp.type) {
      mongooseProp.type = mongoose.Schema.Types.ObjectId;
    }
  }

  // Fallback for z.any() or unhandled types
  if (!mongooseProp.type && type !== 'object') {
    mongooseProp.type = mongoose.Schema.Types.Mixed;
  }

  return mongooseProp;
}

export function toMongooseSchema(
  schema: z.ZodObject<any> | z.ZodTypeAny,
  options?: mongoose.SchemaOptions,
): mongoose.Schema {
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
  };
  const definition = extractMongooseDef(schema);
  return new mongoose.Schema(definition as any, mergedOptions);
}
