import { z } from 'zod/v4';
import mongoose, { SchemaTypeOptions, SchemaOptions, SchemaDefinitionProperty } from 'mongoose';

/**
 * DEFINE THE METADATA SHAPE
 * This interface represents all the Mongoose-specific options you want to
 * support, including custom application flags.
 * We extend both SchemaTypeOptions for field-level properties and SchemaOptions
 * for top-level schema properties, allowing withMongoose to be used on any Zod schema.
 */
interface MongooseMeta extends SchemaTypeOptions<any>, SchemaOptions {
    hiddenFromPublic?: boolean;
    readOnly?: boolean;
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
 * Type-level mapping from Zod to Mongoose Schema Definitions
 */
type ToMongooseType<T extends z.ZodTypeAny> = T extends z.ZodObject<infer Shape> ? {
    [K in keyof Shape]: Shape[K] extends z.ZodTypeAny ? ToMongooseType<Shape[K]> : any;
} : T extends z.ZodArray<infer Element> ? Element extends z.ZodTypeAny ? Array<ToMongooseType<Element>> | {
    type: Array<any>;
    [key: string]: any;
} : Array<any> : T extends z.ZodOptional<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : T extends z.ZodDefault<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : T extends z.ZodNullable<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : SchemaDefinitionProperty<any> & {
    [key: string]: any;
};
/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
declare function extractMongooseDef<T extends z.ZodTypeAny>(schema: T, visited?: Map<z.ZodTypeAny, any>): ToMongooseType<T> & SchemaDefinitionProperty<any>;
declare function toMongooseSchema<T extends z.ZodTypeAny>(schema: T, options?: SchemaOptions): mongoose.Schema<z.infer<T>>;

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;
declare const zObjectId: (options?: MongooseMeta) => z.ZodCustom<mongoose.Types.ObjectId, mongoose.Types.ObjectId>;
declare const zBuffer: (options?: MongooseMeta) => z.ZodCustom<Buffer<ArrayBufferLike>, Buffer<ArrayBufferLike>>;
declare const genTimestampsSchema: <CrAt = "createdAt", UpAt = "updatedAt">(createdAtField?: StringLiteral<CrAt | "createdAt"> | null, updatedAtField?: StringLiteral<UpAt | "updatedAt"> | null) => z.ZodObject<{
    [x: string]: any;
}, z.core.$strip>;
declare const bufferMongooseGetter: (value: unknown) => any;

export { bufferMongooseGetter, extractMongooseDef, genTimestampsSchema, mongooseRegistry, toMongooseSchema, withMongoose, zBuffer, zObjectId };
export type { MongooseMeta, ToMongooseType };
