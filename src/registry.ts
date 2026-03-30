import {z} from 'zod/v4';
import {SchemaTypeOptions} from 'mongoose';
/**
 * DEFINE THE METADATA SHAPE
 * This interface represents all the Mongoose-specific options you want to
 * support, including custom application flags.
 */
export interface MongooseMeta extends SchemaTypeOptions<any> {
  // Schema-level options
  timestamps?: boolean | {createdAt?: string | boolean; updatedAt?: string | boolean};
  discriminatorKey?: string;

  // Allow any other custom properties
  [key: string]: any;
}

/**
 * 2. CREATE THE ZOD v4 REGISTRY
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
export const mongooseRegistry = z.registry<MongooseMeta>();

/**
 * 3. HELPER FUNCTION
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
export function withMongoose<T extends z.ZodTypeAny>(schema: T, meta: MongooseMeta): T {
  const existing = mongooseRegistry.get(schema) || {};
  // @ts-expect-error - TS sometimes struggles with complex Mongoose types in Registry
  mongooseRegistry.add(schema, {...existing, ...meta});
  return schema;
}
