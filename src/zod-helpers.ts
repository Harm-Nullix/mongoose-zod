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
  visited: Set<z.ZodTypeAny> = new Set(),
): {schema: z.ZodTypeAny; features: SchemaFeatures} {
  if (!schema) return {schema, features};
  if (visited.has(schema)) return {schema, features};
  visited.add(schema);

  const def = (schema as any)._def;
  if (!def) return {schema, features};

  if (schema instanceof z.ZodOptional) {
    return unwrapZodSchema(
      // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
      schema.unwrap(),
      {
        ...features,
        required: false,
        isOptional: true,
      },
      visited,
    );
  }

  if (schema instanceof z.ZodNullable) {
    return unwrapZodSchema(
      // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
      schema.unwrap(),
      {
        ...features,
        isNullable: true,
      },
      visited,
    );
  }

  if (schema instanceof z.ZodDefault) {
    const defaultValue =
      typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
    return unwrapZodSchema(
      def.innerType,
      {
        ...features,
        default: defaultValue,
      },
      visited,
    );
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
      return unwrapZodSchema(def.out, features, visited);
    }

    if (outType === 'transform' || outType === 'refinement') {
      // It's a transform or refine (in is schema, out is logic)
      return unwrapZodSchema(def.in, features, visited);
    }

    // Default pipe behavior (extract the input part)
    return unwrapZodSchema(def.in, features, visited);
  }

  if (
    type === 'transform' ||
    type === 'preprocess' ||
    type === 'refinement' ||
    type === 'effects'
  ) {
    const inner = def.schema || def.innerType;
    if (inner) {
      const result = unwrapZodSchema(inner, features, visited);
      // Ensure we check registry for intermediate schemas if needed,
      // but the registry check is now in extractMongooseDef.
      return result;
    }
  }

  if (type === 'lazy') {
    // For lazy types, we need to be careful with infinite recursion.
    // If we've already seen this specific lazy schema in this unwrapping chain,
    // we return it as is to stop recursion.
    // NOTE: In Zod v4, getter() might return different objects each time if not careful.
    return {schema, features};
  }

  if (type === 'branded') {
    return unwrapZodSchema((schema as any).unwrap(), features, visited);
  }

  return {schema, features};
}
