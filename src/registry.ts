import { z } from 'zod/v4';

/**
 * 1. DEFINE THE METADATA SHAPE
 * This interface represents all the Mongoose-specific options you want to
 * support, including your custom application flags like `hiddenFromPublic`.
 */
export interface MongooseMeta {
  type?: any; // Override the type (e.g., mongoose.Schema.Types.Mixed)
  required?: boolean;
  unique?: boolean;
  index?: boolean;
  default?: any | (() => any); // Mongoose allows functions for defaults
  validate?: any;

  // Custom application flags
  hiddenFromPublic?: boolean;
  readOnlyForDefaultPatch?: boolean;
  readOnly?: boolean;
  exposeCRUDViaSubRoutes?: boolean;

  // Schema-level options
  timestamps?: boolean | {createdAt?: string | boolean; updatedAt?: string | boolean};

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
export function withMongoose<T extends z.ZodTypeAny>(
  schema: T,
  meta: MongooseMeta
): T {
  mongooseRegistry.add(schema, meta);
  return schema;
}
