import { z } from 'zod/v4';
import mongoose from 'mongoose';

/**
 * 2. CREATE THE ZOD v4 REGISTRY
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
const mongooseRegistry = z.registry();
/**
 * 3. HELPER FUNCTION
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
function withMongoose(schema, meta) {
    const existing = mongooseRegistry.get(schema) || {};
    // @ts-expect-error - TS sometimes struggles with complex Mongoose types in Registry
    mongooseRegistry.add(schema, { ...existing, ...meta });
    return schema;
}

/**
 * Recursively unwrap Zod schemas (Optional, Nullable, Default, Effects, Pipelines)
 * using Zod's public API and internal _def.type identifiers.
 */
function unwrapZodSchema(schema, 
// eslint-disable-next-line unicorn/no-object-as-default-parameter
features = { required: true }, visited = new Set()) {
    if (!schema)
        return { schema, features };
    if (visited.has(schema))
        return { schema, features };
    visited.add(schema);
    const def = schema._def;
    if (!def)
        return { schema, features };
    if (schema instanceof z.ZodOptional) {
        return unwrapZodSchema(
        // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
        schema.unwrap(), {
            ...features,
            required: false,
            isOptional: true,
        }, visited);
    }
    if (schema instanceof z.ZodNullable) {
        return unwrapZodSchema(
        // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
        schema.unwrap(), {
            ...features,
            isNullable: true,
        }, visited);
    }
    if (schema instanceof z.ZodDefault) {
        const defaultValue = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
        return unwrapZodSchema(def.innerType, {
            ...features,
            default: defaultValue,
        }, visited);
    }
    const { type } = def;
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
    if (type === 'transform' ||
        type === 'preprocess' ||
        type === 'refinement' ||
        type === 'effects') {
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
        return { schema, features };
    }
    if (type === 'branded' || type === 'readonly') {
        return unwrapZodSchema(schema.unwrap(), {
            ...features,
            ...(type === 'readonly' ? { readOnly: true } : {}),
        }, visited);
    }
    // Extract checks if present
    if (def.checks && Array.isArray(def.checks)) {
        features.checks = [...(features.checks || []), ...def.checks];
    }
    return { schema, features };
}

/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
function extractMongooseDef(schema, visited = new Map()) {
    const { schema: unwrapped, features } = unwrapZodSchema(schema);
    // Pull any explicitly registered Mongoose metadata for the ORIGINAL schema instance
    // or any intermediate schemas if it's a chain of effects.
    const meta = mongooseRegistry.get(schema) || {};
    const unwrappedMeta = mongooseRegistry.get(unwrapped) || {};
    const mongooseProp = { ...unwrappedMeta, ...meta };
    // If zObjectId() or similar were used, they might be wrapped in withMongoose again.
    // zObjectId returns withMongoose(z.custom(), {type: ObjectId}).
    // If we have nested metadata, we should prioritize the one that has a 'type' property.
    // Actually, unwrappedMeta should have the type if it came from zObjectId.
    // But if the user also used withMongoose(zObjectId(), {type: ...}), that should win.
    if (visited.has(unwrapped)) {
        const existing = visited.get(unwrapped);
        if (Object.keys(meta).length > 0) {
            Object.assign(existing, mongooseProp);
        }
        return existing;
    }
    // We must ensure recursive calls see the current object to break cycles.
    // We use mongooseProp for now, and if it's an object/array, we'll fill it.
    visited.set(unwrapped, mongooseProp);
    if (features.default !== undefined) {
        mongooseProp.default = features.default;
    }
    if (features.required === false) {
        mongooseProp.required = false;
    }
    if (features.readOnly === true) {
        mongooseProp.readOnly = true;
    }
    // Map Zod checks to Mongoose options
    if (features.checks && Array.isArray(features.checks)) {
        for (const check of features.checks) {
            const traitSet = check._zod?.traits;
            const checkDef = check._zod?.def;
            if (!traitSet || !checkDef)
                continue;
            // String Lengths
            if (traitSet.has('$ZodCheckMinLength')) {
                mongooseProp.minlength = checkDef.minimum;
            }
            if (traitSet.has('$ZodCheckMaxLength')) {
                mongooseProp.maxlength = checkDef.maximum;
            }
            if (traitSet.has('$ZodCheckLengthEquals')) {
                mongooseProp.minlength = checkDef.length;
                mongooseProp.maxlength = checkDef.length;
            }
            // Numbers and Dates Comparisons
            if (traitSet.has('$ZodCheckGreaterThan')) {
                mongooseProp.min = checkDef.value;
            }
            if (traitSet.has('$ZodCheckLessThan')) {
                mongooseProp.max = checkDef.value;
            }
            // Regex / Match
            if (traitSet.has('$ZodCheckRegex')) {
                mongooseProp.match = checkDef.pattern;
            }
            // String Transforms (trim, lowercase, uppercase)
            if (traitSet.has('$ZodCheckOverwrite') && typeof checkDef.tx === 'function') {
                const txStr = checkDef.tx.toString();
                if (txStr.includes('.trim()')) {
                    mongooseProp.trim = true;
                }
                else if (txStr.includes('.toLowerCase()')) {
                    mongooseProp.lowercase = true;
                }
                else if (txStr.includes('.toUpperCase()')) {
                    mongooseProp.uppercase = true;
                }
            }
        }
    }
    const def = unwrapped._def;
    if (!def)
        return mongooseProp;
    const { type } = def;
    // 1. Handle Objects (Recursion)
    if (type === 'object') {
        const { shape } = unwrapped;
        const objDef = {};
        // We must ensure recursive calls see the current object to break cycles.
        // If we have a type override, we use mongooseProp, otherwise we use objDef.
        const placeholder = mongooseProp.type ? mongooseProp : objDef;
        visited.set(unwrapped, placeholder);
        // eslint-disable-next-line no-restricted-syntax
        for (const key in shape) {
            if (!Object.prototype.hasOwnProperty.call(shape, key))
                continue;
            objDef[key] = extractMongooseDef(shape[key], visited);
        }
        // If the developer didn't provide a strict Mongoose type override, return the shape
        if (!mongooseProp.type) {
            Object.assign(mongooseProp, objDef);
            return objDef;
        }
        // If there is a type override, merge the object definition into the result
        Object.assign(mongooseProp, objDef);
    }
    // Handle Arrays, Sets and Tuples
    if (type === 'array' || type === 'set' || type === 'tuple') {
        const element = unwrapped.element ||
            unwrapped._def.valueType ||
            unwrapped._def.rest ||
            unwrapped._def.items?.[0];
        const innerDef = element ? extractMongooseDef(element, visited) : mongoose.Schema.Types.Mixed;
        // If no explicit type override, wrap the inner definition in an array
        if (!mongooseProp.type) {
            const innerType = innerDef.type || innerDef;
            // Special case: If innerType is Mixed because of z.any(), we should represent it clearly
            mongooseProp.type = [innerType];
        }
    }
    // Handle Records and Maps
    if (type === 'record' || type === 'map') {
        const valueType = unwrapped.valueSchema || unwrapped._def.valueType;
        if (!mongooseProp.type) {
            mongooseProp.type = Map;
            if (valueType) {
                const innerDef = extractMongooseDef(valueType, visited);
                mongooseProp.of = innerDef.type || innerDef;
            }
        }
    }
    // Handle Intersections
    if (type === 'intersection') {
        const left = extractMongooseDef(unwrapped._def.left, visited);
        const right = extractMongooseDef(unwrapped._def.right, visited);
        if (typeof left === 'object' && typeof right === 'object') {
            Object.assign(mongooseProp, left, right);
        }
        else if (!mongooseProp.type) {
            mongooseProp.type = mongoose.Schema.Types.Mixed;
        }
    }
    // Handle Unions
    if ((type === 'union' ||
        type === 'discriminatedunion' ||
        type === 'discriminated_union' ||
        type === 'literal') &&
        !mongooseProp.type) {
        mongooseProp.type = mongoose.Schema.Types.Mixed;
    }
    // Handle Primitives
    switch (type) {
        case 'string': {
            if (!mongooseProp.type)
                mongooseProp.type = String;
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        case 'number': {
            if (!mongooseProp.type)
                mongooseProp.type = Number;
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        case 'boolean': {
            if (!mongooseProp.type)
                mongooseProp.type = Boolean;
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        case 'date': {
            if (!mongooseProp.type)
                mongooseProp.type = Date;
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        case 'bigint': {
            if (!mongooseProp.type) {
                // Map BigInt to native BigInt if available
                mongooseProp.type = typeof BigInt === 'undefined' ? Number : BigInt;
            }
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        // Do nothing
    }
    // Handle Enums
    if (type === 'enum') {
        if (!mongooseProp.type)
            mongooseProp.type = String;
        mongooseProp.enum = unwrapped.options || def.values;
        if (mongooseProp.required !== false)
            mongooseProp.required = true;
    }
    else if (type === 'nativeenum' || type === 'native_enum') {
        if (!mongooseProp.type)
            mongooseProp.type = String;
        mongooseProp.enum = Object.values(unwrapped.enum || def.values);
        if (mongooseProp.required !== false)
            mongooseProp.required = true;
    }
    // Handle Specialized Types (Buffer, ObjectId)
    if (type === 'any' || type === 'unknown' || type === 'custom') {
        const cls = def.cls || unwrapped.cls;
        if (cls === Buffer) {
            if (!mongooseProp.type)
                mongooseProp.type = mongoose.Schema.Types.Buffer;
        }
        else if ((cls?.name === 'ObjectId' || cls === mongoose.Types.ObjectId) &&
            !mongooseProp.type) {
            mongooseProp.type = mongoose.Schema.Types.ObjectId;
        }
    }
    // Handle Lazy (Recursion Support)
    if (type === 'lazy') {
        const inner = def.getter();
        // Re-call with the inner schema, passing the visited map to break cycles
        const result = extractMongooseDef(inner, visited);
        // If we have metadata, merge the lazy result into it
        if (Object.keys(meta).length > 0 && result !== mongooseProp) {
            if (typeof result === 'object' && !Array.isArray(result)) {
                Object.assign(mongooseProp, result);
            }
            else {
                mongooseProp.type = result.type || result;
            }
            return mongooseProp;
        }
        return result;
    }
    // Fallback for z.any() or unhandled types
    if (!mongooseProp.type && type !== 'object') {
        mongooseProp.type = mongoose.Schema.Types.Mixed;
    }
    return mongooseProp;
}
function toMongooseSchema(schema, options) {
    const { schema: unwrapped } = unwrapZodSchema(schema);
    const meta = mongooseRegistry.get(schema) ||
        mongooseRegistry.get(unwrapped) ||
        schema.meta?.() ||
        unwrapped.meta?.() ||
        {};
    const mergedOptions = {
        // Also merge other schema options from meta if they exist
        ...(meta.collection ? { collection: meta.collection } : {}),
        ...(meta.strict !== undefined ? { strict: meta.strict } : {}),
        ...(meta.id !== undefined ? { id: meta.id } : {}),
        ...(meta._id !== undefined ? { _id: meta._id } : {}),
        ...(meta.minimize !== undefined ? { minimize: meta.minimize } : {}),
        ...(meta.validateBeforeSave !== undefined ? { validateBeforeSave: meta.validateBeforeSave } : {}),
        ...(meta.versionKey !== undefined ? { versionKey: meta.versionKey } : {}),
        ...(meta.timestamps ? { timestamps: meta.timestamps } : {}),
        ...(meta.discriminatorKey ? { discriminatorKey: meta.discriminatorKey } : {}),
        ...options,
    };
    const definition = extractMongooseDef(schema);
    return new mongoose.Schema(definition, mergedOptions);
}

const zObjectId = (options) => withMongoose(z.custom(), {
    type: mongoose.Schema.Types.ObjectId,
    ...options,
});
const zBuffer = (options) => withMongoose(z.custom(), {
    type: mongoose.Schema.Types.Buffer,
    ...options,
});
const DateFieldZod = () => z.date().default(() => new Date());
const genTimestampsSchema = (createdAtField = 'createdAt', updatedAtField = 'updatedAt') => {
    if (createdAtField != null &&
        updatedAtField != null &&
        createdAtField === updatedAtField) {
        throw new Error('`createdAt` and `updatedAt` fields must be different');
    }
    const shape = {};
    if (createdAtField != null) {
        shape[createdAtField] = withMongoose(DateFieldZod(), { immutable: true, index: true });
    }
    if (updatedAtField != null) {
        shape[updatedAtField] = withMongoose(DateFieldZod(), { index: true });
    }
    const schema = z.object(shape);
    const meta = {
        timestamps: {
            createdAt: createdAtField == null ? false : createdAtField,
            updatedAt: updatedAtField == null ? false : updatedAtField,
        },
    };
    // Attach metadata to the instance if supported, but also register it
    const schemaWithMeta = withMongoose(schema, meta);
    schemaWithMeta.meta = () => meta;
    return schemaWithMeta;
};
const bufferMongooseGetter = (value) => value != null && value._bsontype === 'Binary' ? value.buffer : value;

export { bufferMongooseGetter, extractMongooseDef, genTimestampsSchema, mongooseRegistry, toMongooseSchema, withMongoose, zBuffer, zObjectId };
//# sourceMappingURL=index.js.map
