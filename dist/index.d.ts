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
        mongoose: <O extends ZodObject<T, UnknownKeys, Catchall, Output, Input>, TInstanceMethods extends {} = {}, QueryHelpers extends {} = {}, TStaticMethods extends {} = {}, TVirtuals extends {} = {}>(this: O, metadata?: MongooseMetadata<O['_output'], TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>) => ZodMongoose<O, O['_output'], TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
    }
}
declare const toZodMongooseSchema: (zObject: ZodObject<any>, metadata?: {}) => ZodMongoose<ZodObject<any, "strip", z.ZodTypeAny, {
    [x: string]: any;
}, {
    [x: string]: any;
}>, unknown, {}, {}, {}, {}>;
declare const addMongooseTypeOptions: (zObject: z.ZodType, options: SchemaTypeOptions<any, any> | undefined) => z.ZodType<any, z.ZodTypeDef, any>;
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
declare const genTimestampsSchema: <CrAt = "createdAt", UpAt = "updatedAt">(createdAtField?: "createdAt" | StringLiteral<CrAt> | null, updatedAtField?: "updatedAt" | StringLiteral<UpAt> | null) => z.ZodObject<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; } extends infer T_2 extends z.ZodRawShape ? { [k_2 in keyof T_2]: { [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }[k_2]["_output"]; } : never> extends infer T ? { [k_1 in keyof T]: z.objectUtil.addQuestionMarks<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; } extends infer T_1 extends z.ZodRawShape ? { [k in keyof T_1]: { [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }[k]["_output"]; } : never>[k_1]; } : never, z.objectUtil.addQuestionMarks<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; } extends infer T_5 extends z.ZodRawShape ? { [k_2_1 in keyof T_5]: { [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }[k_2_1]["_input"]; } : never> extends infer T_3 ? { [k_3 in keyof T_3]: z.objectUtil.addQuestionMarks<{ [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; } extends infer T_4 extends z.ZodRawShape ? { [k_2 in keyof T_4]: { [_ in StringLiteral<CrAt & {}> | StringLiteral<UpAt & {}>]: z.ZodDefault<z.ZodDate>; }[k_2]["_input"]; } : never>[k_3]; } : never>;
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
declare const toMongooseSchema: <Schema extends ZodMongoose<any, any, {}, {}, {}, {}>>(rootZodSchema: Schema, options?: {
    disablePlugins?: DisableablePlugins | true;
    unknownKeys?: UnknownKeysHandling;
}) => M.Schema<z$1.TypeOf<Schema>, any, MongooseSchemaTypeParameters<Schema, "InstanceMethods">, MongooseSchemaTypeParameters<Schema, "QueryHelpers">, Partial<MongooseSchemaTypeParameters<Schema, "TVirtuals">>, MongooseSchemaTypeParameters<Schema, "TStaticMethods">, "type", M.ObtainDocumentType<any, z$1.TypeOf<Schema>, "type">>;

declare const mongooseZodCustomType: <T extends "ObjectId" | "Array" | "Buffer" | "Decimal128" | "DocumentArray" | "Map" | "Subdocument">(typeName: T, params?: Parameters<ZodTypeAny['refine']>[1]) => z.ZodType<InstanceType<T extends "Buffer" ? BufferConstructor : (typeof M.Types)[T]>, z.ZodTypeDef, InstanceType<T extends "Buffer" ? BufferConstructor : (typeof M.Types)[T]>>;

export { MongooseSchemaOptionsSymbol, MongooseTypeOptionsSymbol, MongooseZodError, UnknownKeysHandling, ZodMongoose, addMongooseTypeOptions, bufferMongooseGetter, genTimestampsSchema, mongooseZodCustomType, toMongooseSchema, toZodMongooseSchema };
