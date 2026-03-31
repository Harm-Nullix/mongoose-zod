'use strict';

var v4 = require('zod/v4');

/**
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
const mongooseRegistry = v4.z.registry();
/**
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
    const def = schema._def;
    if (!def)
        return { schema, features };
    // Skip visited check for wrappers to allow deep unwrapping
    if (!(schema instanceof v4.z.ZodOptional) &&
        !(schema instanceof v4.z.ZodNullable) &&
        !(schema instanceof v4.z.ZodDefault) &&
        def.type !== 'pipe') {
        visited.add(schema);
    }
    if (schema instanceof v4.z.ZodOptional) {
        const inner = schema.unwrap();
        return unwrapZodSchema(
        // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
        inner, {
            ...features,
            required: false,
            isOptional: true,
        }, visited);
    }
    if (schema instanceof v4.z.ZodNullable) {
        return unwrapZodSchema(
        // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
        schema.unwrap(), {
            ...features,
            isNullable: true,
        }, visited);
    }
    if (schema instanceof v4.z.ZodDefault) {
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

// Helper to get mongoose types safely without top-level import
const getMongoose = () => {
    try {
        // eslint-disable-next-line global-require
        const m = require('mongoose');
        if (m && (m.Schema || m.default?.Schema)) {
            return m.default || m;
        }
        return m;
    }
    catch {
        // Try to see if mongoose is globally available (e.g. in some environments)
        if (globalThis.mongoose) {
            return globalThis.mongoose;
        }
        return null;
    }
};
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
    // If we have a chain of wrappers (e.g. zObjectId().optional()), we should collect
    // metadata from all of them.
    let currentMeta = { ...unwrappedMeta, ...meta };
    if (schema._def.innerType) {
        let inner = schema._def.innerType;
        while (inner) {
            const innerMeta = mongooseRegistry.get(inner);
            if (innerMeta) {
                currentMeta = { ...innerMeta, ...currentMeta };
            }
            inner = inner._def?.innerType || inner._def?.schema;
        }
    }
    const mongooseProp = currentMeta;
    if (features.isOptional === true && mongooseProp.type && mongooseProp.required !== true) {
        // If it was explicitly marked as optional in Zod, and it's a leaf node (has a type),
        // we respect that by setting required: false, unless the user explicitly forced required: true in meta.
        mongooseProp.required = false;
    }
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
            // Skip automatic _id mapping unless explicitly requested
            if (key === '_id') {
                const idMeta = mongooseRegistry.get(shape[key]) || {};
                const unwrappedId = unwrapZodSchema(shape[key]).schema;
                const unwrappedIdMeta = mongooseRegistry.get(unwrappedId) || {};
                if (idMeta.includeId !== true && unwrappedIdMeta.includeId !== true)
                    continue;
            }
            objDef[key] = extractMongooseDef(shape[key], visited);
        }
        // If the developer didn't provide a strict Mongoose type override, return the shape
        if (!mongooseProp.type) {
            Object.assign(mongooseProp, objDef);
            // If we have any Mongoose-specific metadata besides the shape itself, return mongooseProp.
            // Otherwise return just the shape (objDef).
            // We exclude top-level only options from triggering the "metadata" flag for nested paths,
            // as they should be handled by toMongooseSchema.
            // We also exclude 'required' if it's explicitly set to false by our unwrap logic for objects.
            const topLevelOptions = new Set([
                'collection',
                'versionKey',
                'timestamps',
                'discriminatorKey',
                'strict',
                'id',
                '_id',
                'minimize',
                'validateBeforeSave',
            ]);
            const hasFieldMetadata = Object.keys(mongooseProp).some((k) => {
                if (Object.prototype.hasOwnProperty.call(objDef, k))
                    return false;
                if (topLevelOptions.has(k))
                    return false;
                if (k === 'required' && mongooseProp[k] === false)
                    return false;
                return true;
            });
            return (hasFieldMetadata ? mongooseProp : objDef);
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
        const mongoose = getMongoose();
        const innerDef = element
            ? extractMongooseDef(element, visited)
            : mongoose?.Schema.Types.Mixed || 'Mixed';
        // If no explicit type override, wrap the inner definition in an array
        if (!mongooseProp.type) {
            const innerType = innerDef.type || innerDef;
            // Special case: If innerType is Mixed because of z.any(), we should represent it clearly
            mongooseProp.type = [innerType];
            // Transfer any metadata from the inner type (like 'ref') to the array definition
            if (typeof innerDef === 'object') {
                Object.assign(mongooseProp, innerDef);
                mongooseProp.type = [innerType]; // Restore type as array
            }
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
            mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
        }
    }
    // Handle Unions
    if ((type === 'union' ||
        type === 'discriminatedunion' ||
        type === 'discriminated_union' ||
        type === 'literal') &&
        !mongooseProp.type) {
        mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
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
    const mongooseInstance = getMongoose();
    if (type === 'any' || type === 'unknown' || type === 'custom') {
        const cls = def.cls || unwrapped.cls;
        if (cls === Buffer || (typeof Uint8Array !== 'undefined' && cls === Uint8Array)) {
            if (!mongooseProp.type)
                mongooseProp.type = mongooseInstance?.Schema.Types.Buffer || 'Buffer';
        }
        else if ((cls?.name === 'ObjectId' || (mongooseInstance && cls === mongooseInstance.Types.ObjectId)) &&
            !mongooseProp.type) {
            mongooseProp.type = mongooseInstance?.Schema.Types.ObjectId || 'ObjectId';
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
        mongooseProp.type = getMongoose()?.Schema.Types.Mixed || 'Mixed';
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
        // eslint-disable-next-line unicorn/no-negated-condition
        ...(meta.strict !== undefined ? { strict: meta.strict } : {}),
        // eslint-disable-next-line unicorn/no-negated-condition
        ...(meta.minimize !== undefined ? { minimize: meta.minimize } : {}),
        // eslint-disable-next-line unicorn/no-negated-condition
        ...(meta.validateBeforeSave !== undefined ? { validateBeforeSave: meta.validateBeforeSave } : {}),
        // eslint-disable-next-line unicorn/no-negated-condition
        ...(meta.versionKey !== undefined ? { versionKey: meta.versionKey } : {}),
        ...(meta.id === undefined ? {} : { id: meta.id }),
        ...(meta._id === undefined ? {} : { _id: meta._id }),
        ...(meta.timestamps ? { timestamps: meta.timestamps } : {}),
        ...(meta.discriminatorKey ? { discriminatorKey: meta.discriminatorKey } : {}),
        ...options,
    };
    const definition = extractMongooseDef(schema);
    const mongoose = getMongoose();
    if (!mongoose) {
        // Last ditch effort: check if it's imported in the global scope
        const globalMongoose = globalThis.mongoose;
        if (globalMongoose) {
            return new globalMongoose.Schema(definition, mergedOptions);
        }
        throw new Error('Mongoose must be installed to use toMongooseSchema. If you are in an ESM environment, ensure mongoose is loaded.');
    }
    return new mongoose.Schema(definition, mergedOptions);
}

let isFrontend = false;
/**
 * Enable or disable frontend mode.
 * In frontend mode, specialized types like ObjectId and Buffer fall back to
 * simpler representations (strings/arrays) and do not depend on Mongoose.
 */
const setFrontendMode = (enabled) => {
    isFrontend = enabled;
};
const getFrontendMode = () => {
    // Try to auto-detect if not explicitly set
    // This is a simple heuristic: check for window/document
    if (isFrontend === undefined || isFrontend === null) {
        return globalThis.window !== undefined && globalThis.document !== undefined;
    }
    return isFrontend;
};

// Helper to get mongoose types safely without top-level import
const getMongooseTypes = () => {
    try {
        // eslint-disable-next-line global-require
        return require('mongoose');
    }
    catch {
        return null;
    }
};
const zObjectId = (options) => {
    if (getFrontendMode()) {
        return withMongoose(v4.z.preprocess((val) => (val === null ? undefined : val), v4.z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId')), {
            type: 'ObjectId', // String representation for metadata
            ...options,
        });
    }
    const mongoose = getMongooseTypes();
    return withMongoose(v4.z.preprocess((val) => (val === null ? undefined : val), v4.z.custom((val) => (mongoose && val instanceof mongoose.Types.ObjectId) ||
        (typeof val === 'string' && /^[\dA-Fa-f]{24}$/.test(val)))), {
        type: mongoose?.Schema.Types.ObjectId || 'ObjectId',
        ...options,
    });
};
const zBuffer = (options) => {
    if (getFrontendMode()) {
        return withMongoose(v4.z.instanceof(Uint8Array), {
            type: 'Buffer',
            ...options,
        });
    }
    const mongoose = getMongooseTypes();
    return withMongoose(v4.z.custom((val) => (mongoose && val instanceof Buffer) || val instanceof Uint8Array), {
        type: mongoose?.Schema.Types.Buffer || 'Buffer',
        ...options,
    });
};
const zPopulated = (ref, schema, options) => {
    const isFrontend = getFrontendMode();
    const mongoose = getMongooseTypes();
    const objectIdSchema = isFrontend
        ? v4.z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId')
        : v4.z.custom((val) => (mongoose && val instanceof mongoose.Types.ObjectId) ||
            (typeof val === 'string' && /^[\dA-Fa-f]{24}$/.test(val)));
    return withMongoose(v4.z.union([objectIdSchema, schema]), {
        type: isFrontend ? 'ObjectId' : mongoose?.Schema.Types.ObjectId || 'ObjectId',
        ref,
        ...options,
    });
};
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
exports.getFrontendMode = getFrontendMode;
exports.mongooseRegistry = mongooseRegistry;
exports.setFrontendMode = setFrontendMode;
exports.toMongooseSchema = toMongooseSchema;
exports.withMongoose = withMongoose;
exports.zBuffer = zBuffer;
exports.zObjectId = zObjectId;
exports.zPopulated = zPopulated;
//# sourceMappingURL=index.cjs.map
