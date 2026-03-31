import {z} from 'zod/v4';
import {callHookSync} from './hooks.js';

/**
 * DEFINE THE METADATA SHAPE
 * This interface represents all the Mongoose-specific options you want to
 * support, including custom application flags.
 * We use a more permissive base to avoid recursive type checking issues with
 * complex Mongoose types in the registry and hooks.
 */
export interface MongooseMeta extends Record<string, any> {
  explicitId?: boolean;
}

/**
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
export const mongooseRegistry = z.registry<MongooseMeta>();

/**
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
export function withMongoose<T extends z.ZodTypeAny>(schema: T, meta: MongooseMeta): T {
  const existing = mongooseRegistry.get(schema) || {};
  const merged = {...existing, ...meta};
  mongooseRegistry.add(schema, merged);
  callHookSync('registry:add', {schema, meta: merged});
  return schema;
}
