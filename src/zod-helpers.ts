import {z} from 'zod/v4';

export interface SchemaFeatures {
  default?: any;
  required?: boolean;
  isOptional?: boolean;
  isNullable?: boolean;
}

/**
 * Recursively unwrap Zod schemas (Optional, Nullable, Default, Effects, Pipelines)
 * using Zod's public API and internal _def.type identifiers.
 */
export function unwrapZodSchema(
  schema: z.ZodTypeAny,
  // eslint-disable-next-line unicorn/no-object-as-default-parameter
  features: SchemaFeatures = {required: true},
): {schema: z.ZodTypeAny; features: SchemaFeatures} {
  if (!schema) return {schema, features};

  const def = (schema as any)._def;
  if (!def) return {schema, features};

  if (schema instanceof z.ZodOptional) {
    // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
    return unwrapZodSchema(schema.unwrap(), {
      ...features,
      required: false,
      isOptional: true,
    });
  }

  if (schema instanceof z.ZodNullable) {
    // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
    return unwrapZodSchema(schema.unwrap(), {
      ...features,
      isNullable: true,
    });
  }

  if (schema instanceof z.ZodDefault) {
    const defaultValue =
      typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
    return unwrapZodSchema(def.innerType, {
      ...features,
      default: defaultValue,
    });
  }

  const {type} = def;

  // In Zod v4, transform, preprocess, and refine are often implemented as pipes.
  // For transform: in = schema, out = transformation
  // For preprocess: in = preprocessing, out = schema
  if (type === 'pipe') {
    const inType = def.in?._def?.type;
    const outType = def.out?._def?.type;

    if (inType === 'transform') {
      // It's a preprocess (in is transformation, out is schema)
      return unwrapZodSchema(def.out, features);
    }

    if (outType === 'transform' || outType === 'refinement') {
      // It's a transform or refine (in is schema, out is logic)
      return unwrapZodSchema(def.in, features);
    }

    // Default pipe behavior (extract the input part)
    return unwrapZodSchema(def.in, features);
  }

  if (
    type === 'transform' ||
    type === 'preprocess' ||
    type === 'refinement' ||
    type === 'effects'
  ) {
    const inner = def.schema || def.innerType;
    if (inner) {
      const result = unwrapZodSchema(inner, features);
      // Ensure we check registry for intermediate schemas if needed,
      // but the registry check is now in extractMongooseDef.
      return result;
    }
  }

  if (type === 'lazy') {
    return unwrapZodSchema(def.getter(), features);
  }

  if (type === 'branded') {
    return unwrapZodSchema((schema as any).unwrap(), features);
  }

  return {schema, features};
}
