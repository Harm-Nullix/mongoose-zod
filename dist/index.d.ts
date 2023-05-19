import z$1, { z, ZodObject, ZodTypeAny } from 'zod';
export { z } from 'zod';
import M, { SchemaTypeOptions, SchemaOptions } from 'mongoose';

declare class MongooseZodError extends Error {
}

type PartialLaconic<T> = {} extends T ? {} : Partial<T>;

declare const MongooseTypeOptionsSymbol: unique symbol;
declare const MongooseSchemaOptionsSymbol: unique symbol;
interface MongooseMetadata<DocType, TInstanceMethods extends {} = {}, QueryHelpers extends {} = {}, TStaticMethods extends {} = {}, TVirtuals extends {} = {}> {
    typeOptions?: {
        [Field in keyof DocType]?: SchemaTypeOptions<DocType[Field], DocType>;
    };
    schemaOptions?: Omit<SchemaOptions<any, DocType, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>, 'castNonArrays'>;
}
interface ZodMongooseDef<ZodType extends z.ZodTypeAny, DocType, TInstanceMethods extends {} = {}, QueryHelpers extends {} = {}, TStaticMethods extends {} = {}, TVirtuals extends {} = {}> extends z.ZodTypeDef {
    innerType: ZodType;
    mongoose: MongooseMetadata<DocType, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
}
declare class ZodMongoose<ZodType extends z.ZodTypeAny, DocType, TInstanceMethods extends {} = {}, QueryHelpers extends {} = {}, TStaticMethods extends {} = {}, TVirtuals extends {} = {}> extends z.ZodType<DocType & PartialLaconic<TVirtuals>, ZodMongooseDef<ZodType, DocType, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>> {
    _parse(input: z.ParseInput): z.ParseReturnType<this['_output']>;
    static create<ZodType extends z.ZodObject<any>, DocType, TInstanceMethods extends {} = {}, QueryHelpers extends {} = {}, TStaticMethods extends {} = {}, TVirtuals extends {} = {}>(def: ZodMongooseDef<ZodType, DocType, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>): ZodMongoose<ZodType, DocType, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
}
declare module 'zod' {
    interface ZodTypeDef {
        [MongooseTypeOptionsSymbol]?: SchemaTypeOptions<any>;
        [MongooseSchemaOptionsSymbol]?: SchemaOptions;
    }
    interface ZodSchema {
        mongooseTypeOptions<T extends ZodSchema<any>>(this: T, options: SchemaTypeOptions<T['_output']>): T;
    }
    interface ZodObject<T extends z.ZodRawShape, UnknownKeys extends 'passthrough' | 'strict' | 'strip' = 'strip', Catchall extends z.ZodTypeAny = z.ZodTypeAny, Output = z.objectOutputType<T, Catchall>, Input = z.objectInputType<T, Catchall>> {
        mongoose: <ZO extends ZodObject<T, UnknownKeys, Catchall, Output, Input>, TInstanceMethods extends {} = {}, QueryHelpers extends {} = {}, TStaticMethods extends {} = {}, TVirtuals extends {} = {}>(this: ZO, metadata?: MongooseMetadata<ZO['_output'], TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>) => ZodMongoose<ZO, ZO['_output'], TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
    }
}
declare const toZodMongooseSchema: <ZO extends ZodObject<any, z.UnknownKeysParam, z.ZodTypeAny, {
    [x: string]: any;
}, {
    [x: string]: any;
}>, TInstanceMethods extends {} = {}, QueryHelpers extends {} = {}, TStaticMethods extends {} = {}, TVirtuals extends {} = {}>(zObject: ZO, metadata?: MongooseMetadata<ZO["_output"], TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>) => ZodMongoose<ZO, ZO["_output"], TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
declare const addMongooseTypeOptions: <T extends z.ZodType<any, z.ZodTypeDef, any>>(zObject: T, options: SchemaTypeOptions<T["_output"], any>) => T;
declare module 'mongoose' {
    interface MZValidateFn<T, ThisType> {
        (this: ThisType, value: T): boolean;
    }
    interface MZLegacyAsyncValidateFn<T, ThisType> {
        (this: ThisType, value: T, done: (result: boolean) => void): void;
    }
    interface MZAsyncValidateFn<T, ThisType> {
        (this: ThisType, value: T): Promise<boolean>;
    }
    interface MZValidateOpts<T, ThisType> {
        msg?: string;
        message?: string | ValidatorMessageFn;
        type?: string;
        validator: MZValidateFn<T, ThisType> | MZLegacyAsyncValidateFn<T, ThisType> | MZAsyncValidateFn<T, ThisType>;
    }
    type MZSchemaValidator<T, ThisType> = RegExp | [RegExp, string] | MZValidateFn<T, ThisType> | [MZValidateFn<T, ThisType>, string] | MZValidateOpts<T, ThisType>;
    interface MZRequiredFn<ThisType> {
        (this: ThisType): boolean;
    }
    interface SchemaTypeOptions<T, ThisType = any> {
        mzValidate?: MZSchemaValidator<Exclude<T, undefined>, ThisType | undefined>;
        mzRequired?: boolean | MZRequiredFn<ThisType | null> | [boolean, string] | [MZRequiredFn<ThisType | null>, string];
    }
}

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;
declare const genTimestampsSchema: <CrAt = "createdAt", UpAt = "updatedAt">(createdAtField?: "createdAt" | StringLiteral<CrAt> | null, updatedAtField?: "updatedAt" | StringLiteral<UpAt> | null) => z.ZodObject<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }>, (z.baseObjectOutputType<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }> extends infer T_2 ? { [k_2 in keyof T_2]: undefined extends z.baseObjectOutputType<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }>[k_2] ? never : k_2; } : never)[StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]> extends infer T ? { [k_1 in keyof T]: z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }>, (z.baseObjectOutputType<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }> extends infer T_1 ? { [k in keyof T_1]: undefined extends z.baseObjectOutputType<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }>[k] ? never : k; } : never)[StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]>[k_1]; } : never, z.baseObjectInputType<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }> extends infer T_3 ? { [k_2 in keyof T_3]: z.baseObjectInputType<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }>[k_2]; } : never>;
type MongooseSchemaTypeParameters<T, Parameter extends 'InstanceMethods' | 'QueryHelpers' | 'TStaticMethods' | 'TVirtuals'> = T extends ZodMongoose<any, any, infer InstanceMethods, infer QueryHelpers, infer TStaticMethods, infer TVirtuals> ? {
    InstanceMethods: InstanceMethods;
    QueryHelpers: QueryHelpers;
    TStaticMethods: TStaticMethods;
    TVirtuals: TVirtuals;
}[Parameter] : {};
declare const bufferMongooseGetter: (value: unknown) => unknown;

type UnknownKeysHandling = 'throw' | 'strip' | 'strip-unless-overridden';
interface DisableablePlugins {
    leanVirtuals?: boolean;
    leanDefaults?: boolean;
    leanGetters?: boolean;
}
interface ToMongooseSchemaOptions {
    disablePlugins?: DisableablePlugins | true;
    unknownKeys?: UnknownKeysHandling;
}
interface SetupOptions {
    z?: typeof z | null;
    defaultToMongooseSchemaOptions?: ToMongooseSchemaOptions;
}

declare const toMongooseSchema: <Schema extends ZodMongoose<any, any, {}, {}, {}, {}>>(rootZodSchema: Schema, options?: ToMongooseSchemaOptions) => M.Schema<z$1.TypeOf<Schema>, any, MongooseSchemaTypeParameters<Schema, "InstanceMethods">, MongooseSchemaTypeParameters<Schema, "QueryHelpers">, Partial<MongooseSchemaTypeParameters<Schema, "TVirtuals">>, MongooseSchemaTypeParameters<Schema, "TStaticMethods">, M.DefaultSchemaOptions, M.ObtainDocumentType<any, z$1.TypeOf<Schema>, M.DefaultSchemaOptions>, M.IfAny<M.FlatRecord<M.ObtainDocumentType<any, z$1.TypeOf<Schema>, M.DefaultSchemaOptions>>, any, M.Document<unknown, {}, M.FlatRecord<M.ObtainDocumentType<any, z$1.TypeOf<Schema>, M.DefaultSchemaOptions>>> & Omit<M.Require_id<M.FlatRecord<M.ObtainDocumentType<any, z$1.TypeOf<Schema>, M.DefaultSchemaOptions>>>, keyof (Partial<MongooseSchemaTypeParameters<Schema, "TVirtuals">> & MongooseSchemaTypeParameters<Schema, "InstanceMethods"> extends infer T ? T extends Partial<MongooseSchemaTypeParameters<Schema, "TVirtuals">> & MongooseSchemaTypeParameters<Schema, "InstanceMethods"> ? T extends Record<string, never> ? {} : M.IfAny<T, {}, T> : never : never)> & (Partial<MongooseSchemaTypeParameters<Schema, "TVirtuals">> & MongooseSchemaTypeParameters<Schema, "InstanceMethods"> extends infer T ? T extends Partial<MongooseSchemaTypeParameters<Schema, "TVirtuals">> & MongooseSchemaTypeParameters<Schema, "InstanceMethods"> ? T extends Record<string, never> ? {} : M.IfAny<T, {}, T> : never : never)>>;

declare const mongooseZodCustomType: <T extends "ObjectId" | "Buffer" | "Decimal128" | "Array" | "DocumentArray" | "Map" | "Subdocument">(typeName: T, params?: Parameters<ZodTypeAny['refine']>[1]) => z.ZodType<InstanceType<T extends "Buffer" ? BufferConstructor : (typeof M.Types)[T]>, z.ZodTypeDef, InstanceType<T extends "Buffer" ? BufferConstructor : (typeof M.Types)[T]>>;

declare const setup: (options?: SetupOptions) => void;

export { DisableablePlugins, MongooseSchemaOptionsSymbol, MongooseTypeOptionsSymbol, MongooseZodError, SetupOptions, ToMongooseSchemaOptions, UnknownKeysHandling, ZodMongoose, addMongooseTypeOptions, bufferMongooseGetter, genTimestampsSchema, mongooseZodCustomType, setup, toMongooseSchema, toZodMongooseSchema };
