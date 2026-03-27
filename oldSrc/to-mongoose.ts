import M, {Schema as MongooseSchema, SchemaTypes} from 'mongoose';
import type {z} from 'zod/v4';
import {MongooseSchemaOptionsSymbol, MongooseTypeOptionsSymbol, ZodMongoose} from './extensions.js';
import {
  MZLeanOptions,
  getLeanDefaultsImplementation,
  getLeanGettersImplementation,
  getLeanVirtualsImplementation,
} from './mongoose-helpers.js';
import {SchemaFeatures, isZodType, unwrapZodSchema} from './zod-helpers.js';
import {MongooseZodError} from './errors.js';
import {zodInstanceofOriginalClasses} from './zodInstances.service.js';
import {getValidEnumValues} from './utils.js';

const {
  Mixed: MongooseMixed,
  Number: MongooseZodNumber,
  String: MongooseZodString,
  Date: MongooseZodDate,
  Boolean: MongooseZodBoolean,
  BigInt: MongooseZodBigInt,
} = SchemaTypes;

export interface ToMongooseSchemaOptions {
  [key: string]: any;
  /**
   * Lean options.
   * By default, it adds support for:
   * - `mongoose-lean-virtuals`
   * - `mongoose-lean-defaults`
   * - `mongoose-lean-getters`
   */
  lean?: MZLeanOptions | boolean;
  /**
   * If true, it will not add the custom `lean` query method implementation.
   */
  disableCustomLean?: boolean;
  /**
   * If true, it will not add any of the plugins.
   */
  disablePlugins?: boolean | 'all' | DisableablePlugins[];
}

export type DisableablePlugins =
  | 'mongoose-lean-virtuals'
  | 'mongoose-lean-defaults'
  | 'mongoose-lean-getters';

const getStrictOptionValue = (
  unknownKeys: SchemaFeatures['unknownKeys'],
  schemaFeatures: SchemaFeatures,
) => {
  if (unknownKeys === 'passthrough') {
    return false;
  }
  if (unknownKeys === 'strict') {
    return 'throw';
  }
  return schemaFeatures.unknownKeys !== 'passthrough';
};

const addMongooseSchemaFields = (
  zodSchema: z.ZodType<any, any, any>,
  monSchema: MongooseSchema,
  context: {
    fieldsStack: string[];
    monTypeOptions?: any;
    typeKey: string;
    isRoot: boolean;
  },
) => {
  const {fieldsStack, isRoot} = context;
  const fieldPath = fieldsStack.join('.');

  const throwError = (message: string, noPath?: boolean) => {
    throw new MongooseZodError(`${noPath ? '' : `Path \`${fieldPath}\`: `}${message}`);
  };

  const {schema: zodSchemaFinal, features: schemaFeatures} = unwrapZodSchema(zodSchema);
  if (!zodSchemaFinal) return;

  const monMetadata = schemaFeatures.mongoose || {};

  const {
    mongooseTypeOptions: monTypeOptionsFromField,
    mongooseSchemaOptions: monSchemaOptionsFromField,
    isOptional,
    unknownKeys,
    unionSchemaType,
  } = schemaFeatures;

  const monTypeOptionsFromMetadata = monMetadata.typeOptions?.[fieldsStack.at(-1)];

  const commonFieldOptions: any = {
    ...monTypeOptionsFromField,
    ...monTypeOptionsFromMetadata,
    ...context.monTypeOptions,
  };

  if ('default' in schemaFeatures) {
    commonFieldOptions.default = schemaFeatures.default;
  }

  const {mzValidate, mzRequired} = commonFieldOptions;

  if (mzValidate) {
    const isArray = Array.isArray(mzValidate);
    const validator = isArray ? mzValidate[0] : mzValidate.validator || mzValidate;
    const message = isArray ? mzValidate[1] : mzValidate.message || (validator as any).message;
    commonFieldOptions.validate = {
      validator,
      message,
    };
  }

  let isRequired = !isOptional;
  if (mzRequired != null) {
    isRequired = Array.isArray(mzRequired) ? mzRequired[0] : mzRequired;
    commonFieldOptions.required = mzRequired;
  }

  if (isRequired) {
    if (
      commonFieldOptions.required !== true &&
      !isRoot &&
      !(zodSchemaFinal instanceof ZodMongoose) &&
      (zodSchemaFinal as any)?.innerType == null &&
      (zodSchema as any)?.mongoose == null &&
      (zodSchema as any)._def?.mongoose == null &&
      (zodSchema as any).def?.mongoose == null &&
      (zodSchemaFinal as any)?.mongoose == null &&
      (zodSchemaFinal as any)?._def?.mongoose == null &&
      (zodSchemaFinal as any)?.def?.mongoose == null &&
      commonFieldOptions.required !== false &&
      schemaFeatures.default === undefined
    ) {
      commonFieldOptions.required = true;
    }
  } else if (
    commonFieldOptions.required === true ||
    (commonFieldOptions.required && commonFieldOptions.required[0] === true)
  ) {
    throwError("Can't have `required` set to true and `.optional()` used");
  }

  let fieldType: any;
  let errMsgAddendum = '';

  const typeKey = (isRoot ? monSchemaOptionsFromField?.typeKey : context.typeKey) ?? 'type';

  if (isZodType(zodSchemaFinal, 'ZodObject')) {
    const relevantSchema = isRoot
      ? monSchema
      : new MongooseSchema(
          {},
          {
            strict: getStrictOptionValue(unknownKeys, schemaFeatures),
            ...monSchemaOptionsFromField,
            typeKey,
            ...monMetadata?.schemaOptions,
            ...(zodSchemaFinal as any)[MongooseSchemaOptionsSymbol],
            ...monMetadata?.mongoose?.schemaOptions,
          },
        );

    const def =
      (zodSchemaFinal as any).def ||
      (zodSchemaFinal as any)._def ||
      (zodSchemaFinal as any)._zod?.def;
    const shape = typeof def?.shape === 'function' ? def.shape() : def?.shape;

    if (shape) {
      for (const [key, S] of Object.entries(shape) as [string, any][]) {
        addMongooseSchemaFields(S, relevantSchema, {
          ...context,
          fieldsStack: [...fieldsStack, key],
          monTypeOptions: monMetadata.typeOptions?.[key],
          typeKey:
            (monMetadata?.schemaOptions?.typeKey || (relevantSchema as any).options?.typeKey) ??
            typeKey,
          isRoot: false,
        });
      }
    }
    if (isRoot) return;
    if (!('_id' in commonFieldOptions)) commonFieldOptions._id = false;
    fieldType = relevantSchema;
  } else if (
    isZodType(zodSchemaFinal, 'ZodNumber') ||
    unionSchemaType === 'number' ||
    (zodSchemaFinal as any)?.typeName === 'ZodNumber' ||
    (zodSchemaFinal as any)?._def?.typeName === 'ZodNumber'
  ) {
    fieldType = MongooseZodNumber;
  } else if (
    isZodType(zodSchemaFinal, 'ZodString') ||
    unionSchemaType === 'string' ||
    (zodSchemaFinal as any)?.typeName === 'ZodString' ||
    (zodSchemaFinal as any)?._def?.typeName === 'ZodString'
  ) {
    fieldType = MongooseZodString;
  } else if (
    isZodType(zodSchemaFinal, 'ZodDate') ||
    unionSchemaType === 'date' ||
    (zodSchemaFinal as any)?.typeName === 'ZodDate' ||
    (zodSchemaFinal as any)?._def?.typeName === 'ZodDate'
  ) {
    fieldType = MongooseZodDate;
  } else if (
    isZodType(zodSchemaFinal, 'ZodBigInt') ||
    unionSchemaType === 'bigint' ||
    (zodSchemaFinal as any)?.typeName === 'ZodBigInt' ||
    (zodSchemaFinal as any)?._def?.typeName === 'ZodBigInt'
  ) {
    fieldType = MongooseZodBigInt;
  } else if (
    isZodType(zodSchemaFinal, 'ZodBoolean') ||
    unionSchemaType === 'boolean' ||
    (zodSchemaFinal as any)?.typeName === 'ZodBoolean' ||
    (zodSchemaFinal as any)?._def?.typeName === 'ZodBoolean'
  ) {
    fieldType = MongooseZodBoolean;
  } else if (isZodType(zodSchemaFinal, 'ZodLiteral')) {
    const def =
      (zodSchemaFinal as any).def ||
      (zodSchemaFinal as any)._def ||
      (zodSchemaFinal as any)._zod?.def;
    const literalValue = def?.value;
    const literalJsType = typeof literalValue;
    switch (literalJsType) {
      case 'boolean': {
        fieldType = MongooseZodBoolean;
        break;
      }
      case 'number': {
        fieldType = Number.isNaN(literalValue)
          ? MongooseMixed
          : Number.isFinite(literalValue)
            ? MongooseZodNumber
            : undefined;
        break;
      }
      case 'bigint': {
        fieldType = MongooseZodBigInt;
        break;
      }
      case 'string': {
        fieldType = MongooseZodString;
        break;
      }
      case 'object': {
        if (!literalValue) fieldType = MongooseMixed;
        errMsgAddendum = 'object literals are not supported';
        break;
      }
      default: {
        errMsgAddendum = 'only boolean, number, bigint, string or null literals are supported';
      }
    }
  } else if (isZodType(zodSchemaFinal, 'ZodEnum')) {
    const def =
      (zodSchemaFinal as any).def ||
      (zodSchemaFinal as any)._def ||
      (zodSchemaFinal as any)._zod?.def;
    const enumValues = def?.values;
    if (
      Array.isArray(enumValues) &&
      enumValues.length > 0 &&
      enumValues.every((v) => typeof v === 'string')
    ) {
      fieldType = MongooseZodString;
    } else {
      errMsgAddendum = 'only nonempty zod enums with string values are supported';
    }
  } else if (isZodType(zodSchemaFinal, 'ZodNativeEnum')) {
    const def =
      (zodSchemaFinal as any).def ||
      (zodSchemaFinal as any)._def ||
      (zodSchemaFinal as any)._zod?.def;
    const enumValues = getValidEnumValues(def?.values);
    const valuesJsTypes = [...new Set(enumValues.map((v) => typeof v))];
    if (valuesJsTypes.length === 1 && valuesJsTypes[0] === 'number') fieldType = MongooseZodNumber;
    else if (valuesJsTypes.length === 1 && valuesJsTypes[0] === 'bigint')
      fieldType = MongooseZodBigInt;
    else if (valuesJsTypes.length === 1 && valuesJsTypes[0] === 'string')
      fieldType = MongooseZodString;
    else if (
      valuesJsTypes.length >= 2 &&
      valuesJsTypes.every((t) => (['string', 'number', 'bigint'] as const).includes(t as any))
    )
      fieldType = MongooseMixed;
    else {
      errMsgAddendum =
        'only nonempty native enums with number, bigint and strings values are supported';
    }
  } else if (
    isZodType(zodSchemaFinal, 'ZodDiscriminatedUnion') ||
    isZodType(zodSchemaFinal, 'ZodIntersection') ||
    isZodType(zodSchema, 'ZodNaN') ||
    isZodType(zodSchemaFinal, 'ZodNaN') ||
    isZodType(zodSchema, 'ZodNull') ||
    isZodType(zodSchemaFinal, 'ZodNull') ||
    isZodType(zodSchemaFinal, 'ZodUnknown') ||
    isZodType(zodSchemaFinal, 'ZodRecord') ||
    isZodType(zodSchemaFinal, 'ZodUnion') ||
    isZodType(zodSchemaFinal, 'ZodTuple')
  ) {
    fieldType = MongooseMixed;
  } else if (isZodType(zodSchemaFinal, 'ZodAny')) {
    const instanceOfClass = zodInstanceofOriginalClasses.get(zodSchemaFinal);
    fieldType = instanceOfClass || MongooseMixed;
    if (instanceOfClass === MongooseSchema.Types.Buffer && !('get' in commonFieldOptions)) {
      commonFieldOptions.get = (v: any) => (v != null && v._bsontype === 'Binary' ? v.buffer : v);
    }
  }

  if (isRoot && !(zodSchemaFinal instanceof ZodMongoose)) {
    const def =
      (zodSchemaFinal as any).def ||
      (zodSchemaFinal as any)._def ||
      (zodSchemaFinal as any)._zod?.def;
    const typeName = def?.type || (zodSchemaFinal as any).constructor?.name || 'unknown';
    throw new MongooseZodError(`You must provide object schema at root level (got ${typeName})`);
  }

  if (fieldType == null) {
    const def =
      (zodSchemaFinal as any).def ||
      (zodSchemaFinal as any)._def ||
      (zodSchemaFinal as any)._zod?.def;
    if (def?.mongooseZodCustomType) {
      fieldType = def.mongooseZodCustomType;
    } else if (
      !(zodSchemaFinal instanceof ZodMongoose) &&
      (zodSchemaFinal as any)?.innerType == null
    ) {
      const typeName = def?.type || (zodSchemaFinal as any).constructor?.name || 'unknown';
      throwError(
        `${typeName} type is not supported${errMsgAddendum ? ` (${errMsgAddendum})` : ''}`,
      );
    }
  }

  if (schemaFeatures.array) {
    for (let i = 0; i < schemaFeatures.array.wrapInArrayTimes; i++) {
      fieldType = [fieldType];
    }
  }

  monSchema.add({
    [fieldsStack.at(-1)]: {
      ...commonFieldOptions,
      [typeKey]: fieldType,
    },
  });
};

export const toMongooseSchema = (
  zodSchema: z.ZodType<any, any, any>,
  options: ToMongooseSchemaOptions = {},
): MongooseSchema => {
  const {schema: zodSchemaFinal, features: schemaFeatures} = unwrapZodSchema(zodSchema);
  if (!zodSchemaFinal) {
    throw new MongooseZodError(`You must provide a valid Zod schema at root level`);
  }
  const monMetadata = schemaFeatures.mongoose || {};
  const schemaOptionsFromZod =
    (zodSchemaFinal as any)[MongooseSchemaOptionsSymbol] ||
    (zodSchema as any)[MongooseSchemaOptionsSymbol] ||
    (zodSchema as any)._def?.[MongooseSchemaOptionsSymbol];

  if (zodSchemaFinal instanceof ZodMongoose) {
    // Expected path
  } else if ((zodSchema as any).mongoose || (zodSchema as any)._def?.mongoose) {
    // Also allow if the root zodSchema (before unwrapping) had .mongoose() called
  } else {
    const s = zodSchemaFinal as any;
    const def = s?.def || s?._def || s?._zod?.def;
    const typeName = def?.type || s?.constructor?.name || 'unknown';
    throw new MongooseZodError(`You must provide object schema at root level (got ${typeName})`);
  }

  const monSchemaOptions: any = {
    id: false,
    minimize: false,
    strict: getStrictOptionValue(undefined, schemaFeatures),
    ...schemaOptionsFromZod,
    ...monMetadata.schemaOptions,
  };

  const monSchema = new MongooseSchema({}, monSchemaOptions);

  if (monMetadata.schemaOptions?.timestamps) {
    monSchema.set('timestamps', monMetadata.schemaOptions.timestamps);
  }
  if (monSchemaOptions.timestamps) {
    monSchema.set('timestamps', monSchemaOptions.timestamps);
  }

  // Ensure options.timestamps is also set correctly on the schema object itself
  // to satisfy tests checking monSchema.options.timestamps
  if (monSchema.get('timestamps')) {
    (monSchema as any).options.timestamps = monSchema.get('timestamps');
  }

  if (monMetadata.schemaOptions?._id === false || monSchemaOptions._id === false) {
    monSchema.set('_id', false);
    (monSchema as any).options._id = false;
  }

  if (monMetadata.schemaOptions?.id === false || monSchemaOptions.id === false) {
    monSchema.set('id', false);
    (monSchema as any).options.id = false;
  }

  addMongooseSchemaFields(zodSchema, monSchema, {
    fieldsStack: [],
    typeKey: monSchemaOptions.typeKey || 'type',
    isRoot: true,
  });

  const leanOptions = options.lean ?? true;
  if (leanOptions) {
    const mzLeanOptions = typeof leanOptions === 'object' ? leanOptions : {};
    const disablePlugins =
      options.disablePlugins === true || options.disablePlugins === 'all'
        ? ['mongoose-lean-virtuals', 'mongoose-lean-defaults', 'mongoose-lean-getters']
        : Array.isArray(options.disablePlugins)
          ? options.disablePlugins
          : [];

    if (mzLeanOptions.virtuals !== false && !disablePlugins.includes('mongoose-lean-virtuals'))
      monSchema.plugin(getLeanVirtualsImplementation());
    if (mzLeanOptions.defaults !== false && !disablePlugins.includes('mongoose-lean-defaults'))
      monSchema.plugin(getLeanDefaultsImplementation());
    if (mzLeanOptions.getters !== false && !disablePlugins.includes('mongoose-lean-getters'))
      monSchema.plugin(getLeanGettersImplementation());
  }

  if (!options.disableCustomLean) {
    (monSchema.query as any).lean = function (this: any, leanOptions?: any) {
      if (leanOptions === false) {
        if (typeof this._lean === 'function') {
          return this._lean(false);
        }
        this.options.lean = false;
        this.options.leanWithVirtuals = false;
        this.options.leanWithDefaults = false;
        this.options.leanWithGetters = false;
        return this;
      }

      const leanVal = leanOptions ?? true;
      if (typeof this._lean === 'function') {
        this._lean(leanVal);
      } else {
        this.options.lean = leanVal;
      }

      const mzLeanOptions = typeof leanVal === 'object' ? leanVal : {};
      this.options.leanWithVirtuals = mzLeanOptions.virtuals !== false;
      this.options.leanWithDefaults = mzLeanOptions.defaults !== false;
      this.options.leanWithGetters = mzLeanOptions.getters !== false;

      return this;
    };
  }

  return monSchema;
};
