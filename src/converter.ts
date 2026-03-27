import {z} from 'zod/v4';
import mongoose, {SchemaDefinitionProperty} from 'mongoose';
import {mongooseRegistry} from './registry.js';
import {getTypeName, unwrapZodSchema, getDef} from './zod-helpers.js';

/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
export function extractMongooseDef(schema: z.ZodTypeAny): SchemaDefinitionProperty<any> {
  const {schema: unwrapped, features} = unwrapZodSchema(schema);
  const def = getDef(unwrapped);
  const type = getTypeName(unwrapped);

  // Pull any explicitly registered Mongoose metadata for the ORIGINAL schema instance
  const meta = mongooseRegistry.get(schema) || {};
  const mongooseProp: any = {...meta};

  if (features.default !== undefined) {
    mongooseProp.default = features.default;
  }
  if (features.required === false) {
    mongooseProp.required = false;
  }

  // 1. Handle Objects (Recursion)
  switch (type) {
    case 'object':
    case 'ZodObject': {
      const unwrappedInstance = unwrapped as any;
      const {shape} = unwrappedInstance;
      const objDef: any = {};
      // eslint-disable-next-line no-restricted-syntax
      for (const key in shape) {
        if (!(key in shape)) continue;
        objDef[key] = extractMongooseDef(shape[key]);
      }

      // If this object was created by extending or merging another object,
      // the Mongoose metadata (like timestamps) might be on one of the ancestors.
      // However, Zod doesn't easily expose the original registry entries.

      // If the developer didn't provide a strict Mongoose type override, return the shape
      if (!mongooseProp.type) return objDef;

      break;
    }
    case 'array':
    case 'ZodArray': {
      const innerDef = extractMongooseDef((unwrapped as any).element || (def as any).typeSchema);
      // If no explicit type override, wrap the inner definition in an array
      if (!mongooseProp.type) {
        mongooseProp.type = [(innerDef as any).type || innerDef];
      }

      break;
    }
    case 'string':
    case 'ZodString': {
      if (!mongooseProp.type) mongooseProp.type = String;
      if (mongooseProp.required !== false) mongooseProp.required = true;

      break;
    }
    case 'number':
    case 'ZodNumber': {
      if (!mongooseProp.type) mongooseProp.type = Number;
      if (mongooseProp.required !== false) mongooseProp.required = true;

      break;
    }
    case 'boolean':
    case 'ZodBoolean': {
      if (!mongooseProp.type) mongooseProp.type = Boolean;
      if (mongooseProp.required !== false) mongooseProp.required = true;

      break;
    }
    case 'date':
    case 'ZodDate': {
      if (!mongooseProp.type) mongooseProp.type = Date;
      if (mongooseProp.required !== false) mongooseProp.required = true;

      break;
    }
    case 'any':
    case 'ZodAny':
    case 'ZodUnknown':
    case 'unknown':
    case 'custom':
    case 'ZodCustom': {
      const unwrappedInstance = unwrapped as any;
      const def = getDef(unwrappedInstance);

      if (def?.type === 'custom' && typeof def.fn === 'function') {
        const fnStr = def.fn.toString();
        // Check Buffer FIRST and strictly
        if (
          fnStr.includes('instanceof Buffer') ||
          unwrappedInstance._def?.cls === Buffer ||
          unwrappedInstance.cls === Buffer ||
          (fnStr.includes('instanceof cls') &&
            (unwrappedInstance._def?.cls === Buffer || unwrappedInstance.cls === Buffer))
        ) {
          if (!mongooseProp.type) mongooseProp.type = mongoose.Schema.Types.Buffer;
        } else if (
          (fnStr.includes('ObjectId') ||
            unwrappedInstance._def?.cls?.name === 'ObjectId' ||
            unwrappedInstance.cls?.name === 'ObjectId' ||
            fnStr.includes('instanceof cls')) &&
          !mongooseProp.type
        ) {
          mongooseProp.type = mongoose.Schema.Types.ObjectId;
        }
      }
      break;
    }
    case 'bigint':
    case 'ZodBigInt': {
      if (!mongooseProp.type) {
        // Map BigInt to native BigInt if available
        mongooseProp.type = typeof BigInt === 'undefined' ? Number : BigInt;
      }
      if (mongooseProp.required !== false) mongooseProp.required = true;

      break;
    }
    default: {
      if (
        type === 'enum' ||
        type === 'ZodEnum' ||
        type === 'ZodNativeEnum' ||
        type === 'nativeenum' ||
        unwrapped.constructor?.name === 'ZodEnum'
      ) {
        if (!mongooseProp.type) mongooseProp.type = String;
        const values =
          (unwrapped as any)._def.values ||
          (unwrapped as any)._def.entries ||
          Object.values((unwrapped as any)._def.values || (unwrapped as any)._def.entries || {});
        mongooseProp.enum = Array.isArray(values) ? values : Object.values(values);
        if (mongooseProp.required !== false) mongooseProp.required = true;
      }
    }
  }

  // Fallback for z.any() or unhandled types
  if (!mongooseProp.type && type !== 'object' && type !== 'ZodObject') {
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

  // If this is a ZodObject, it might have been extended from another object that had the metadata
  if (!meta.timestamps && (unwrapped as any)._def?.typeName === 'ZodObject') {
    // Check if it's an extension or merge - Zod v4 might store this in _def
    // In Zod v4, extend() creates a new ZodObject with all fields.
    // It doesn't easily point back to the parent in a way that allows us to find the registry entry.
  }

  const mergedOptions = {
    ...options,
    ...(meta.timestamps ? {timestamps: meta.timestamps} : {}),
  };
  const definition = extractMongooseDef(schema);
  return new mongoose.Schema(definition as any, mergedOptions);
}
