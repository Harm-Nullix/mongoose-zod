import {z} from 'zod/v4';

export const getDef = (schema: any) => schema?.def || schema?._def || schema?._zod?.def;

export const getTypeName = (schema: any): string | undefined => {
  const def = getDef(schema);
  if (!def) return undefined;

  // Zod v4 uses .type for some internal things, or .typeName
  return (
    def.type ||
    def.typeName ||
    (schema as any)._typeName ||
    schema.constructor?.name?.replace('Zod', '').toLowerCase()
  );
};

export interface SchemaFeatures {
  default?: any;
  required?: boolean;
  isOptional?: boolean;
  isNullable?: boolean;
  mongoose?: any;
  arrayStack?: number;
}

export const unwrapZodSchema = (
  schema: z.ZodTypeAny,
  // eslint-disable-next-line unicorn/no-object-as-default-parameter
  features: SchemaFeatures = {required: true, arrayStack: 0},
): {schema: z.ZodTypeAny; features: SchemaFeatures} => {
  if (!schema) return {schema, features};

  const def = getDef(schema);
  if (!def) return {schema, features};

  const type = getTypeName(schema);

  switch (type) {
    case 'optional': {
      return unwrapZodSchema((schema as any).unwrap ? (schema as any).unwrap() : def.innerType, {
        ...features,
        required: false,
        isOptional: true,
      });
    }
    case 'nullable': {
      return unwrapZodSchema((schema as any).unwrap ? (schema as any).unwrap() : def.innerType, {
        ...features,
        isNullable: true,
      });
    }
    case 'default': {
      return unwrapZodSchema(def.innerType || (schema as any)._def.innerType, {
        ...features,
        default: typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue,
      });
    }
    case 'transform':
    case 'preprocess':
    case 'refinement':
    case 'effects': {
      return unwrapZodSchema(def.schema || def.innerType || (schema as any)._def.schema, features);
    }
    case 'pipe': {
      return unwrapZodSchema(def.in || (schema as any)._def.in, features);
    }
    case 'lazy': {
      return unwrapZodSchema((schema as any)._def.getter(), features);
    }
    case 'branded': {
      return unwrapZodSchema(
        (schema as any).unwrap ? (schema as any).unwrap() : def.innerType,
        features,
      );
    }
    default: {
      return {schema, features};
    }
  }
};
