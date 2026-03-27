import { z } from 'zod/v4';
import mongoose, { SchemaDefinitionProperty } from 'mongoose';

/**
 * 1. DEFINE THE METADATA SHAPE
 * This interface represents all the Mongoose-specific options you want to
 * support, including your custom application flags like `hiddenFromPublic`.
 */
interface MongooseMeta {
    type?: any;
    required?: boolean;
    unique?: boolean;
    index?: boolean;
    default?: any | (() => any);
    validate?: any;
    hiddenFromPublic?: boolean;
    readOnlyForDefaultPatch?: boolean;
    readOnly?: boolean;
    exposeCRUDViaSubRoutes?: boolean;
    timestamps?: boolean | {
        createdAt?: string | boolean;
        updatedAt?: string | boolean;
    };
    [key: string]: any;
}
/**
 * 2. CREATE THE ZOD v4 REGISTRY
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
declare const mongooseRegistry: z.core.$ZodRegistry<MongooseMeta, z.core.$ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
/**
 * 3. HELPER FUNCTION
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
declare function withMongoose<T extends z.ZodTypeAny>(schema: T, meta: MongooseMeta): T;

/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
declare function extractMongooseDef(schema: z.ZodTypeAny, visited?: Map<z.ZodTypeAny, any>): SchemaDefinitionProperty<any>;
declare function toMongooseSchema(schema: z.ZodObject<any> | z.ZodTypeAny, options?: mongoose.SchemaOptions): mongoose.Schema;

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;
declare const zObjectId: (options?: MongooseMeta) => z.ZodCustom<mongoose.Types.ObjectId, mongoose.Types.ObjectId>;
declare const zBuffer: (options?: MongooseMeta) => z.ZodCustom<Buffer<ArrayBufferLike>, Buffer<ArrayBufferLike>>;
declare const genTimestampsSchema: <CrAt = "createdAt", UpAt = "updatedAt">(createdAtField?: StringLiteral<CrAt | "createdAt"> | null, updatedAtField?: StringLiteral<UpAt | "updatedAt"> | null) => z.ZodObject<{
    [x: string]: any;
}, z.core.$strip>;
declare const bufferMongooseGetter: (value: unknown) => any;

export { bufferMongooseGetter, extractMongooseDef, genTimestampsSchema, mongooseRegistry, toMongooseSchema, withMongoose, zBuffer, zObjectId };
export type { MongooseMeta };
