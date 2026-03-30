import {z} from 'zod/v4';
import {SchemaOptions, SchemaTypeOptions} from 'mongoose';
/**
 * DEFINE THE METADATA SHAPE
 * This interface represents all the Mongoose-specific options you want to
 * support, including custom application flags.
 * We extend both SchemaTypeOptions for field-level properties and SchemaOptions
 * for top-level schema properties, allowing withMongoose to be used on any Zod schema.
 */
export interface MongooseMeta extends SchemaTypeOptions<any>, SchemaOptions {
  // Application-specific custom flags
  hiddenFromPublic?: boolean;
  readOnly?: boolean;

  // Allow any other custom properties
  [key: string]: any;
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
  // @ts-expect-error - TS sometimes struggles with complex Mongoose types in Registry
  mongooseRegistry.add(schema, {...existing, ...meta});
  return schema;
}
