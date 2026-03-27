import type {SchemaTypeOptions as MongooseSchemaTypeOptions, SchemaOptions} from 'mongoose';
import {z} from 'zod/v4';

export const MongooseTypeOptionsSymbol = Symbol.for('MongooseTypeOptions');
export const MongooseSchemaOptionsSymbol = Symbol.for('MongooseSchemaOptions');

export interface MongooseMetadata<
  DocType,
  TInstanceMethods extends {} = {},
  QueryHelpers extends {} = {},
  TStaticMethods extends {} = {},
  TVirtuals extends {} = {},
> {
  typeOptions?: {
    [Field in keyof DocType]?: MongooseSchemaTypeOptions<DocType[Field], DocType>;
  };
  schemaOptions?: Omit<
    SchemaOptions<any, DocType, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>,
    'castNonArrays'
  >;
}

export interface ZodMongooseDef<
  ZodType extends z.ZodTypeAny,
  DocType,
  TInstanceMethods extends {} = {},
  QueryHelpers extends {} = {},
  TStaticMethods extends {} = {},
  TVirtuals extends {} = {},
>
  extends z.core.$ZodTypeDef {
  type: 'custom';
  innerType: ZodType;
  mongoose: MongooseMetadata<DocType, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
}

export class ZodMongoose<
  ZodType extends z.ZodTypeAny,
  DocType,
  TInstanceMethods extends {} = {},
  QueryHelpers extends {} = {},
  TStaticMethods extends {} = {},
  TVirtuals extends {} = {},
> extends (z.ZodType as any) {
  declare readonly _def: ZodMongooseDef<
    ZodType,
    DocType,
    TInstanceMethods,
    QueryHelpers,
    TStaticMethods,
    TVirtuals
  >;
  declare readonly type: string;
  declare readonly def: ZodMongooseDef<
    ZodType,
    DocType,
    TInstanceMethods,
    QueryHelpers,
    TStaticMethods,
    TVirtuals
  >;

  constructor(
    def: ZodMongooseDef<
      ZodType,
      DocType,
      TInstanceMethods,
      QueryHelpers,
      TStaticMethods,
      TVirtuals
    >,
  ) {
    // eslint-disable-next-line constructor-super
    super(def);
    (z.ZodType as any).init(this, def);
    this.type = def.type;
    this.def = def;
  }

  _parse(input: any): any {
    return {status: 'valid', value: input.data};
  }

  mongoose(
    metadata: MongooseMetadata<any, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals> = {},
  ) {
    return ZodMongoose.create({
      mongoose: {
        ...this._def.mongoose,
        ...metadata,
        typeOptions: {
          ...this._def.mongoose.typeOptions,
          ...metadata.typeOptions,
        },
        schemaOptions: {
          ...this._def.mongoose.schemaOptions,
          ...metadata.schemaOptions,
        },
      },
      innerType: this._def.innerType,
    });
  }

  static create<
    ZodType extends z.ZodObject<any>,
    DocType,
    TInstanceMethods extends {} = {},
    QueryHelpers extends {} = {},
    TStaticMethods extends {} = {},
    TVirtuals extends {} = {},
  >(
    def: Omit<
      ZodMongooseDef<ZodType, DocType, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>,
      'type' | 'typeName'
    >,
  ) {
    const inst = new ZodMongoose<
      ZodType,
      DocType,
      TInstanceMethods,
      QueryHelpers,
      TStaticMethods,
      TVirtuals
    >({...def, type: 'custom', typeName: 'ZodMongoose'} as any);

    const inner = (def as any).innerType as any;
    if (inner && ('shape' in inner || (inner.def || inner._zod?.def)?.type === 'object')) {
      (inst as any).shape = inner.shape;
    }

    return inst;
  }
}

declare module 'zod' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace core {
    // eslint-disable-next-line sonarjs/class-name
    interface $ZodTypeDef {
      [MongooseTypeOptionsSymbol]?: MongooseSchemaTypeOptions<any>;
      [MongooseSchemaOptionsSymbol]?: SchemaOptions;
      mongooseZodCustomType?: any;
    }
  }

  // @ts-ignore
  interface ZodObject<
    // @ts-ignore Cast variance
    out Shape extends z.core.$ZodShape = z.core.$ZodLooseShape,
    // @ts-ignore Cast variance
    out Config extends z.core.$ZodObjectConfig = any,
  > {
    mongoose: <
      ZO extends ZodObject<any, any>,
      TInstanceMethods extends {} = {},
      QueryHelpers extends {} = {},
      TStaticMethods extends {} = {},
      TVirtuals extends {} = {},
    >(
      this: ZO,
      metadata?: MongooseMetadata<any, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>,
    ) => ZodMongoose<ZO, any, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
  }

  interface ZodType {
    mongooseTypeOptions<T extends ZodType<any>>(
      this: T,
      options: MongooseSchemaTypeOptions<any>,
    ): T;
    mongoose: <
      T extends ZodType<any>,
      TInstanceMethods extends {} = {},
      QueryHelpers extends {} = {},
      TStaticMethods extends {} = {},
      TVirtuals extends {} = {},
    >(
      this: T,
      metadata?: MongooseMetadata<any, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>,
    ) => ZodMongoose<any, any, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals>;
  }
}

export const toZodMongooseSchema = function <
  ZO extends z.ZodObject<any>,
  TInstanceMethods extends {} = {},
  QueryHelpers extends {} = {},
  TStaticMethods extends {} = {},
  TVirtuals extends {} = {},
>(
  zObject: ZO,
  metadata: MongooseMetadata<any, TInstanceMethods, QueryHelpers, TStaticMethods, TVirtuals> = {},
) {
  return ZodMongoose.create({mongoose: metadata, innerType: zObject});
};

export const addMongooseToZodPrototype = (toZ: typeof z | null) => {
  if (toZ === null) {
    if (z.ZodObject.prototype.mongoose !== undefined) {
      delete (z.ZodObject.prototype as any).mongoose;
    }
  } else if (toZ.ZodObject.prototype.mongoose === undefined) {
    toZ.ZodObject.prototype.mongoose = function (metadata = {}) {
      return toZodMongooseSchema(this, metadata);
    };
  }
};

export const addMongooseTypeOptions = function <T extends z.ZodType<any>>(
  zObject: T,
  options: MongooseSchemaTypeOptions<any>,
) {
  const def = (zObject as any).def || (zObject as any)._def || (zObject as any)._zod?.def;
  if (def) {
    def[MongooseTypeOptionsSymbol] = {
      ...def[MongooseTypeOptionsSymbol],
      ...options,
    };
  }
  return zObject;
};

export const addMongooseTypeOptionsToZodPrototype = (toZ: typeof z | null) => {
  if (toZ === null) {
    if (z.ZodType.prototype.mongooseTypeOptions !== undefined) {
      delete (z.ZodType.prototype as any).mongooseTypeOptions;
    }
  } else if (toZ.ZodType.prototype.mongooseTypeOptions === undefined) {
    toZ.ZodType.prototype.mongooseTypeOptions = function (
      options: MongooseSchemaTypeOptions<any, any>,
    ) {
      return addMongooseTypeOptions(this, options);
    };
  }
};

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

  interface MZRequiredFn<ThisType> {
    (this: ThisType): boolean;
  }

  type MZSchemaValidator<T, ThisType> =
    | RegExp
    | [RegExp, string]
    | MZValidateFn<T, ThisType>
    | [MZValidateFn<T, ThisType>, string]
    | MZValidateOpts<T, ThisType>;

  interface MZValidateOpts<T, ThisType> {
    msg?: string;
    message?: string | ValidatorMessageFn;
    type?: string;
    validator:
      | MZValidateFn<T, ThisType>
      | MZLegacyAsyncValidateFn<T, ThisType>
      | MZAsyncValidateFn<T, ThisType>;
  }

  // @ts-ignore - Mongoose 8 SchemaTypeOptions recursion
  interface SchemaTypeOptions<T, ThisType = any, DocType = any> extends MongooseSchemaTypeOptions<
    T,
    any,
    any
  > {
    mzValidate?: MZSchemaValidator<Exclude<T, undefined>, ThisType | undefined>;
    mzRequired?:
      | boolean
      | MZRequiredFn<ThisType | null>
      | [boolean, string]
      | [MZRequiredFn<ThisType | null>, string];
  }
}

export {z} from 'zod/v4';
