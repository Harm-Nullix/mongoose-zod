import type M from 'mongoose';
import type {z} from 'zod/v4';
import {
  MongooseMetadata,
  MongooseSchemaOptionsSymbol,
  MongooseTypeOptionsSymbol,
  ZodMongoose,
} from './extensions.js';

export interface ZodTypes {
  ZodAny: z.ZodAny;
  ZodArray: z.ZodArray<any>;
  ZodBigInt: z.ZodBigInt;
  ZodBoolean: z.ZodBoolean;
  ZodBranded: z.core.$ZodBranded<any, any>;
  ZodDate: z.ZodDate;
  ZodDefault: z.ZodDefault<any>;
  ZodEffects: z.ZodTransform<any>; // Map ZodEffects to ZodTransform as a starting point
  ZodEnum: z.ZodEnum<any>;
  ZodFunction: z.ZodFunction<any, any>;
  ZodIntersection: z.ZodIntersection<any, any>;
  ZodLazy: z.ZodLazy<any>;
  ZodLiteral: z.ZodLiteral<any>;
  ZodMap: z.ZodMap<any, any>;
  ZodNaN: z.ZodNaN;
  ZodNativeEnum: any; // z.nativeEnum<any> in v4 is a function, not a type
  ZodNull: z.ZodNull;
  ZodNullable: z.ZodNullable<any>;
  ZodNumber: z.ZodNumber;
  ZodObject: z.ZodObject<any>;
  ZodOptional: z.ZodOptional<any>;
  ZodUndefined: z.ZodUndefined;
  ZodPromise: z.ZodPromise<any>;
  ZodRecord: z.ZodRecord<any, any>;
  ZodSet: z.ZodSet<any>;
  ZodSchema: z.ZodType;
  ZodString: z.ZodString;
  ZodTuple: z.ZodTuple<any, any>;
  ZodUnion: z.ZodUnion<any>;
  ZodDiscriminatedUnion: z.ZodDiscriminatedUnion<any, any>;
  ZodUnknown: z.ZodUnknown;
  ZodVoid: z.ZodVoid;

  ZodType: z.ZodType;
  ZodTypeAny: z.ZodTypeAny;
}

export const isZodType = <TypeName extends keyof ZodTypes>(
  schema: any,
  typeName: TypeName,
): schema is ZodTypes[TypeName] => {
  if (!schema) return false;
  const def = schema.def || schema._def || schema._zod?.def;
  if (!def) return false;

  const targetType = typeName.replace('Zod', '').toLowerCase();

  // Direct match on Zod v4 type string
  if (def.type === targetType) return true;

  // Semantic mappings for complex/renamed types
  if (
    typeName === 'ZodEffects' &&
    (def.type === 'transform' ||
      def.type === 'pipe' ||
      def.type === 'preprocess' ||
      def.type === 'refinement')
  )
    return true;
  if (
    typeName === 'ZodDiscriminatedUnion' &&
    (def.type === 'discriminated_union' || (def.type === 'union' && def.discriminator))
  )
    return true;
  if (typeName === 'ZodSchema') return true; // Everything is a schema

  // Fallback for Zod v3 compatibility or specific constructor names
  return schema.constructor?.name === typeName || def.typeName === typeName;
};

export interface SchemaFeatures {
  default?: any;
  isOptional?: boolean;
  unknownKeys?: 'strict' | 'passthrough';
  unionSchemaType?: string;
  array?: {
    wrapInArrayTimes: number;
    originalArraySchema: z.ZodArray<any>;
  };
  mongoose?: MongooseMetadata<any>;
  mongooseTypeOptions?: M.SchemaTypeOptions<any>;
  mongooseSchemaOptions?: M.SchemaOptions;
}

export const unwrapZodSchema = (
  schema: z.ZodType<any, any, any>,
  options: {doNotUnwrapArrays?: boolean} = {},
  _features: SchemaFeatures = {},
): {schema: z.ZodType<any, any, any>; features: SchemaFeatures} => {
  if (!schema) return {schema, features: _features};
  const s = schema as any;
  const def = s.def || s._def || s._zod?.def;
  if (!def) return {schema, features: _features};

  // Collect metadata from current level
  const monTypeOptions = def[MongooseTypeOptionsSymbol];
  _features.mongooseTypeOptions ||= monTypeOptions;
  const monSchemaOptions = def[MongooseSchemaOptionsSymbol];
  _features.mongooseSchemaOptions ||= monSchemaOptions;

  // Handle chainable transformations by type
  switch (def.type) {
    case 'union': {
      const unionSchemaTypes = def.options.map(
        (v: any) => (v.def || v._def || v._zod?.def)?.type || v.constructor.name,
      );
      if (new Set(unionSchemaTypes).size === 1) {
        _features.unionSchemaType ??= unionSchemaTypes[0];
      }
      break;
    }
    case 'optional': {
      return unwrapZodSchema(s.unwrap ? s.unwrap() : def.innerType, options, {
        ..._features,
        isOptional: true,
      });
    }
    case 'default': {
      const defaultValue =
        typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
      return unwrapZodSchema(
        def.innerType,
        options,
        'default' in _features ? _features : {..._features, default: defaultValue},
      );
    }
    case 'nullable':
    case 'branded': {
      return unwrapZodSchema(s.unwrap ? s.unwrap() : def.innerType, options, {..._features});
    }
    case 'transform':
    case 'pipe':
    case 'preprocess':
    case 'refinement': {
      const inner = def.schema || def.innerType || s.in;
      if (inner) return unwrapZodSchema(inner, options, _features);
      break;
    }
    case 'object': {
      if (def.unknownKeys === 'strict' || def.unknownKeys === 'passthrough') {
        const stripped = s.strip ? s.strip() : s;
        return unwrapZodSchema(stripped, options, {..._features, unknownKeys: def.unknownKeys});
      }
      break;
    }
    case 'array': {
      if (!options.doNotUnwrapArrays) {
        const wrapInArrayTimes = Number(_features.array?.wrapInArrayTimes || 0) + 1;
        return unwrapZodSchema(def.typeSchema || def.element || s.element, options, {
          ..._features,
          array: {
            ..._features.array,
            wrapInArrayTimes,
            originalArraySchema: _features.array?.originalArraySchema || (schema as any),
          },
        });
      }
      break;
    }
    case 'custom': {
      if (schema instanceof ZodMongoose) {
        return unwrapZodSchema(def.innerType || (schema as any).innerType, options, {
          ..._features,
          mongoose: def.mongoose || (schema as any).mongoose,
        });
      }
      break;
    }
    default: {
      break;
    }
  }

  return {schema, features: _features};
};
