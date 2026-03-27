'use strict';

var v4 = require('zod/v4');
var mongoose = require('mongoose');

/**
 * 2. CREATE THE ZOD v4 REGISTRY
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
const mongooseRegistry = v4.z.registry();
/**
 * 3. HELPER FUNCTION
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
function withMongoose(schema, meta) {
    mongooseRegistry.add(schema, meta);
    return schema;
}

/**
 * Recursively unwrap Zod schemas (Optional, Nullable, Default, Effects, Pipelines)
 * using Zod's public API and internal _def.type identifiers.
 */
function unwrapZodSchema(schema, 
// eslint-disable-next-line unicorn/no-object-as-default-parameter
features = { required: true }) {
    if (!schema)
        return { schema, features };
    const def = schema._def;
    if (!def)
        return { schema, features };
    if (schema instanceof v4.z.ZodOptional) {
        // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
        return unwrapZodSchema(schema.unwrap(), {
            ...features,
            required: false,
            isOptional: true,
        });
    }
    if (schema instanceof v4.z.ZodNullable) {
        // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
        return unwrapZodSchema(schema.unwrap(), {
            ...features,
            isNullable: true,
        });
    }
    if (schema instanceof v4.z.ZodDefault) {
        const defaultValue = typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue;
        return unwrapZodSchema(def.innerType, {
            ...features,
            default: defaultValue,
        });
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
            return unwrapZodSchema(def.out, features);
        }
        if (outType === 'transform' || outType === 'refinement') {
            // It's a transform or refine (in is schema, out is logic)
            return unwrapZodSchema(def.in, features);
        }
        // Default pipe behavior (extract the input part)
        return unwrapZodSchema(def.in, features);
    }
    if (type === 'transform' ||
        type === 'preprocess' ||
        type === 'refinement' ||
        type === 'effects') {
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
        return unwrapZodSchema(schema.unwrap(), features);
    }
    return { schema, features };
}

/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
function extractMongooseDef(schema) {
    const { schema: unwrapped, features } = unwrapZodSchema(schema);
    // Pull any explicitly registered Mongoose metadata for the ORIGINAL schema instance
    // or any intermediate schemas if it's a chain of effects.
    const meta = mongooseRegistry.get(schema) || mongooseRegistry.get(unwrapped) || {};
    const mongooseProp = { ...meta };
    if (features.default !== undefined) {
        mongooseProp.default = features.default;
    }
    if (features.required === false) {
        mongooseProp.required = false;
    }
    const def = unwrapped._def;
    if (!def)
        return mongooseProp;
    const { type } = def;
    // 1. Handle Objects (Recursion)
    if (type === 'object') {
        const { shape } = unwrapped;
        const objDef = {};
        // eslint-disable-next-line no-restricted-syntax
        for (const key in shape) {
            if (!Object.prototype.hasOwnProperty.call(shape, key))
                continue;
            objDef[key] = extractMongooseDef(shape[key]);
        }
        // If the developer didn't provide a strict Mongoose type override, return the shape
        if (!mongooseProp.type)
            return objDef;
    }
    // 2. Handle Arrays
    if (type === 'array') {
        const innerDef = extractMongooseDef(unwrapped.element);
        // If no explicit type override, wrap the inner definition in an array
        if (!mongooseProp.type) {
            mongooseProp.type = [innerDef.type || innerDef];
        }
    }
    // 3. Handle Primitives
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
    // 4. Handle Enums
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
    // 5. Handle Specialized Types (Buffer, ObjectId)
    if (type === 'any' || type === 'unknown' || type === 'custom') {
        const cls = def.cls || unwrapped.cls;
        if (cls === Buffer) {
            if (!mongooseProp.type)
                mongooseProp.type = mongoose.Schema.Types.Buffer;
        }
        else if (cls?.name === 'ObjectId' && !mongooseProp.type) {
            mongooseProp.type = mongoose.Schema.Types.ObjectId;
        }
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
        ...options,
        ...(meta.timestamps ? { timestamps: meta.timestamps } : {}),
    };
    const definition = extractMongooseDef(schema);
    return new mongoose.Schema(definition, mergedOptions);
}

const DateFieldZod = () => v4.z.date().default(() => new Date());
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
    const schema = v4.z.object(shape);
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

exports.bufferMongooseGetter = bufferMongooseGetter;
exports.extractMongooseDef = extractMongooseDef;
exports.genTimestampsSchema = genTimestampsSchema;
exports.mongooseRegistry = mongooseRegistry;
exports.toMongooseSchema = toMongooseSchema;
exports.withMongoose = withMongoose;
//# sourceMappingURL=index.cjs.map
