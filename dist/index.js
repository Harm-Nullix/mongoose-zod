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
    mongooseRegistry.add(schema, meta);
    return schema;
}

const getDef = (schema) => schema?.def || schema?._def || schema?._zod?.def;
const getTypeName = (schema) => {
    const def = getDef(schema);
    if (!def)
        return undefined;
    // Zod v4 uses .type for some internal things, or .typeName
    return (def.type ||
        def.typeName ||
        schema._typeName ||
        schema.constructor?.name?.replace('Zod', '').toLowerCase());
};
const unwrapZodSchema = (schema, 
// eslint-disable-next-line unicorn/no-object-as-default-parameter
features = { required: true, arrayStack: 0 }) => {
    if (!schema)
        return { schema, features };
    const def = getDef(schema);
    if (!def)
        return { schema, features };
    const type = getTypeName(schema);
    switch (type) {
        case 'optional': {
            return unwrapZodSchema(schema.unwrap ? schema.unwrap() : def.innerType, {
                ...features,
                required: false,
                isOptional: true,
            });
        }
        case 'nullable': {
            return unwrapZodSchema(schema.unwrap ? schema.unwrap() : def.innerType, {
                ...features,
                isNullable: true,
            });
        }
        case 'default': {
            return unwrapZodSchema(def.innerType || schema._def.innerType, {
                ...features,
                default: typeof def.defaultValue === 'function' ? def.defaultValue() : def.defaultValue,
            });
        }
        case 'transform':
        case 'preprocess':
        case 'refinement':
        case 'effects': {
            return unwrapZodSchema(def.schema || def.innerType || schema._def.schema, features);
        }
        case 'pipe': {
            return unwrapZodSchema(def.in || schema._def.in, features);
        }
        case 'lazy': {
            return unwrapZodSchema(schema._def.getter(), features);
        }
        case 'branded': {
            return unwrapZodSchema(schema.unwrap ? schema.unwrap() : def.innerType, features);
        }
        default: {
            return { schema, features };
        }
    }
};

/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
function extractMongooseDef(schema) {
    const { schema: unwrapped, features } = unwrapZodSchema(schema);
    const def = getDef(unwrapped);
    const type = getTypeName(unwrapped);
    // Pull any explicitly registered Mongoose metadata for the ORIGINAL schema instance
    const meta = mongooseRegistry.get(schema) || {};
    const mongooseProp = { ...meta };
    if (features.default !== undefined) {
        mongooseProp.default = features.default;
    }
    if (features.required === false) {
        mongooseProp.required = false;
    }
    // 1. Handle Objects (Recursion)
    switch (type) {
        case 'object':
        case 'ZodObject': {
            const unwrappedInstance = unwrapped;
            const { shape } = unwrappedInstance;
            const objDef = {};
            // eslint-disable-next-line no-restricted-syntax
            for (const key in shape) {
                if (!(key in shape))
                    continue;
                objDef[key] = extractMongooseDef(shape[key]);
            }
            // If this object was created by extending or merging another object,
            // the Mongoose metadata (like timestamps) might be on one of the ancestors.
            // However, Zod doesn't easily expose the original registry entries.
            // If the developer didn't provide a strict Mongoose type override, return the shape
            if (!mongooseProp.type)
                return objDef;
            break;
        }
        case 'array':
        case 'ZodArray': {
            const innerDef = extractMongooseDef(unwrapped.element || def.typeSchema);
            // If no explicit type override, wrap the inner definition in an array
            if (!mongooseProp.type) {
                mongooseProp.type = [innerDef.type || innerDef];
            }
            break;
        }
        case 'string':
        case 'ZodString': {
            if (!mongooseProp.type)
                mongooseProp.type = String;
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        case 'number':
        case 'ZodNumber': {
            if (!mongooseProp.type)
                mongooseProp.type = Number;
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        case 'boolean':
        case 'ZodBoolean': {
            if (!mongooseProp.type)
                mongooseProp.type = Boolean;
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        case 'date':
        case 'ZodDate': {
            if (!mongooseProp.type)
                mongooseProp.type = Date;
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        case 'any':
        case 'ZodAny':
        case 'ZodUnknown':
        case 'unknown':
        case 'custom':
        case 'ZodCustom': {
            const unwrappedInstance = unwrapped;
            const def = getDef(unwrappedInstance);
            if (def?.type === 'custom' && typeof def.fn === 'function') {
                const fnStr = def.fn.toString();
                // Check Buffer FIRST and strictly
                if (fnStr.includes('instanceof Buffer') ||
                    unwrappedInstance._def?.cls === Buffer ||
                    unwrappedInstance.cls === Buffer ||
                    (fnStr.includes('instanceof cls') &&
                        (unwrappedInstance._def?.cls === Buffer || unwrappedInstance.cls === Buffer))) {
                    if (!mongooseProp.type)
                        mongooseProp.type = mongoose.Schema.Types.Buffer;
                }
                else if ((fnStr.includes('ObjectId') ||
                    unwrappedInstance._def?.cls?.name === 'ObjectId' ||
                    unwrappedInstance.cls?.name === 'ObjectId' ||
                    fnStr.includes('instanceof cls')) &&
                    !mongooseProp.type)
                    mongooseProp.type = mongoose.Schema.Types.ObjectId;
            }
            break;
        }
        case 'bigint':
        case 'ZodBigInt': {
            if (!mongooseProp.type) {
                // Map BigInt to native BigInt if available
                mongooseProp.type = typeof BigInt === 'undefined' ? Number : BigInt;
            }
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        default: {
            if (type === 'enum' ||
                type === 'ZodEnum' ||
                type === 'ZodNativeEnum' ||
                type === 'nativeenum' ||
                unwrapped.constructor?.name === 'ZodEnum') {
                if (!mongooseProp.type)
                    mongooseProp.type = String;
                const values = unwrapped._def.values ||
                    unwrapped._def.entries ||
                    Object.values(unwrapped._def.values || unwrapped._def.entries || {});
                mongooseProp.enum = Array.isArray(values) ? values : Object.values(values);
                if (mongooseProp.required !== false)
                    mongooseProp.required = true;
            }
        }
    }
    // Fallback for z.any() or unhandled types
    if (!mongooseProp.type && type !== 'object' && type !== 'ZodObject') {
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
    // If this is a ZodObject, it might have been extended from another object that had the metadata
    if (!meta.timestamps && unwrapped._def?.typeName === 'ZodObject') ;
    const mergedOptions = {
        ...options,
        ...(meta.timestamps ? { timestamps: meta.timestamps } : {}),
    };
    const definition = extractMongooseDef(schema);
    return new mongoose.Schema(definition, mergedOptions);
}

const DateFieldZod = () => z.date().default(() => new Date());
const genTimestampsSchema = (createdAtField = 'createdAt', updatedAtField = 'updatedAt') => {
    if (createdAtField != null && updatedAtField != null && createdAtField === updatedAtField) {
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

export { bufferMongooseGetter, extractMongooseDef, genTimestampsSchema, mongooseRegistry, toMongooseSchema, withMongoose };
//# sourceMappingURL=index.js.map
