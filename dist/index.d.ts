import { z } from 'zod/v4';
import mongoose, { SchemaTypeOptions, SchemaOptions } from 'mongoose';

/**
 * DEFINE THE METADATA SHAPE
 * This interface represents all the Mongoose-specific options you want to
 * support, including custom application flags.
 * We extend both SchemaTypeOptions for field-level properties and SchemaOptions
 * for top-level schema properties, allowing withMongoose to be used on any Zod schema.
 */
interface MongooseMeta extends SchemaTypeOptions<any>, SchemaOptions {
    explicitId?: boolean;
    [key: string]: any;
}
/**
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
declare const mongooseRegistry: z.core.$ZodRegistry<MongooseMeta, z.core.$ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>>;
/**
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
} : Array<any> : T extends z.ZodOptional<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : T extends z.ZodDefault<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : T extends z.ZodNullable<infer Inner> ? Inner extends z.ZodTypeAny ? ToMongooseType<Inner> : any : any;
/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
declare function extractMongooseDef<T extends z.ZodTypeAny>(schema: T, visited?: Map<z.ZodTypeAny, any>): ToMongooseType<T> & Record<string, any>;

/**
 * Converts a Zod schema to a Mongoose Schema instance.
 */
declare function toMongooseSchema<T extends z.ZodTypeAny>(schema: T, options?: SchemaOptions): mongoose.Schema<z.infer<T>>;

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;
declare const zObjectId: (options?: MongooseMeta) => z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodString> | z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodCustom<mongoose.Types.ObjectId, mongoose.Types.ObjectId>>;
declare const zBuffer: (options?: MongooseMeta) => z.ZodCustom<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>> | z.ZodCustom<Buffer<ArrayBufferLike>, Buffer<ArrayBufferLike>>;
declare const zPopulated: <T extends z.ZodTypeAny>(ref: string, schema: T, options?: MongooseMeta) => z.ZodUnion<readonly [z.ZodString | z.ZodCustom<mongoose.Types.ObjectId, mongoose.Types.ObjectId>, T]>;
declare const genTimestampsSchema: <CrAt = "createdAt", UpAt = "updatedAt">(createdAtField?: StringLiteral<CrAt | "createdAt"> | null, updatedAtField?: StringLiteral<UpAt | "updatedAt"> | null) => z.ZodObject<{
    [x: string]: any;
}, z.core.$strip>;
/**
 * Utility type to extract the populated object type from a Zod schema field
 * that uses `zPopulated`. It excludes string and ObjectId from the union,
 * assuming the field is already populated.
 */
type PopulatedSchema<T, K extends keyof T> = Omit<T, K> & {
    [P in K]: T[P] extends Array<infer U> ? Array<Exclude<U, string | mongoose.Types.ObjectId>> : Exclude<T[P], string | mongoose.Types.ObjectId>;
} & {
    _id?: any;
};
declare const bufferMongooseGetter: (value: unknown) => any;

declare const getMongoose: () => any;
/**
 * Enable or disable frontend mode.
 * In frontend mode, specialized types like ObjectId and Buffer fall back to
 * simpler representations (strings/arrays) and do not depend on Mongoose.
 */
declare const setFrontendMode: (enabled: boolean) => void;
declare const getFrontendMode: () => boolean;

export { bufferMongooseGetter, extractMongooseDef, genTimestampsSchema, getFrontendMode, getMongoose, mongooseRegistry, setFrontendMode, toMongooseSchema, withMongoose, zBuffer, zObjectId, zPopulated };
export type { MongooseMeta, PopulatedSchema, ToMongooseType };
