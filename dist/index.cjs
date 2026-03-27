'use strict';

var z = require('zod');
var M = require('mongoose');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
const MongooseTypeOptionsSymbol = Symbol.for('MongooseTypeOptions');
const MongooseSchemaOptionsSymbol = Symbol.for('MongooseSchemaOptions');
class ZodMongoose extends z.z.ZodType {
    _parse(input) {
        return z.z.OK(input.data);
    }
    static create(def) {
        return new ZodMongoose(def);
    }
}
const toZodMongooseSchema = function (zObject, metadata = {}) {
    return ZodMongoose.create({ mongoose: metadata, innerType: zObject });
};
const addMongooseToZodPrototype = (toZ) => {
    if (toZ === null) {
        if (z.z.ZodObject.prototype.mongoose !== undefined) {
            delete z.z.ZodObject.prototype.mongoose;
        }
    }
    else if (toZ.ZodObject.prototype.mongoose === undefined) {
        toZ.ZodObject.prototype.mongoose = function (metadata = {}) {
            return toZodMongooseSchema(this, metadata);
        };
    }
};
const addMongooseTypeOptions = function (zObject, options) {
    zObject._def[MongooseTypeOptionsSymbol] = {
        ...zObject._def[MongooseTypeOptionsSymbol],
        ...options,
    };
    return zObject;
};
const addMongooseTypeOptionsToZodPrototype = (toZ) => {
    if (toZ === null) {
        if (z.z.ZodType.prototype.mongooseTypeOptions !== undefined) {
            delete z.z.ZodType.prototype.mongooseTypeOptions;
        }
    }
    else if (toZ.ZodType.prototype.mongooseTypeOptions === undefined) {
        toZ.ZodType.prototype.mongooseTypeOptions = function (options) {
            return addMongooseTypeOptions(this, options);
        };
    }
};

class MongooseZodError extends Error {
}

const DateFieldZod = () => z.z.date().default(new Date());
const genTimestampsSchema = (createdAtField = 'createdAt', updatedAtField = 'updatedAt') => {
    if (createdAtField != null && updatedAtField != null && createdAtField === updatedAtField) {
        throw new MongooseZodError('`createdAt` and `updatedAt` fields must be different');
    }
    const schema = z.z.object({
        ...(createdAtField != null && {
            [createdAtField]: DateFieldZod().mongooseTypeOptions({ immutable: true, index: true }),
        }),
        ...(updatedAtField != null && {
            [updatedAtField]: DateFieldZod().mongooseTypeOptions({ index: true }),
        }),
    });
    schema._def[MongooseSchemaOptionsSymbol] = {
        ...schema._def[MongooseSchemaOptionsSymbol],
        timestamps: {
            createdAt: createdAtField == null ? false : createdAtField,
            updatedAt: updatedAtField == null ? false : updatedAtField,
        },
    };
    return schema;
};
// const noCastFn = (value: any) => value;
class MongooseZodBoolean extends M.Schema.Types.Boolean {
    static schemaName = 'MongooseZodBoolean';
}
class MongooseZodDate extends M.Schema.Types.Date {
    static schemaName = 'MongooseZodDate';
}
class MongooseZodNumber extends M.Schema.Types.Number {
    static schemaName = 'MongooseZodNumber';
}
class MongooseZodBigInt extends M.Schema.Types.BigInt {
    static schemaName = 'MongooseZodBigInt';
}
class MongooseZodString extends M.Schema.Types.String {
    static schemaName = 'MongooseZodString';
}
const registerCustomMongooseZodTypes = () => {
    Object.assign(M.Schema.Types, {
        MongooseZodBoolean,
        MongooseZodDate,
        MongooseZodNumber,
        MongooseZodBigInt,
        MongooseZodString,
    });
};
const bufferMongooseGetter = (value) => value instanceof M.mongo.Binary ? value.buffer : value;

const setupState = { isSetUp: false };
const setup = (options = {}) => {
    if (setupState.isSetUp) {
        return;
    }
    setupState.isSetUp = true;
    setupState.options = options;
    addMongooseToZodPrototype(null);
    addMongooseTypeOptionsToZodPrototype(null);
    if (options.z !== null) {
        addMongooseToZodPrototype(options.z || z.z);
        addMongooseTypeOptionsToZodPrototype(options.z || z.z);
    }
};

// Source: https://github.com/colinhacks/zod/blob/474d8f610a331b44a64f82f3d77e3d2d0ad6011a/src/helpers/util.ts#L29
const getValidEnumValues = (obj) => {
    const validKeys = Object.keys(obj).filter((k) => typeof obj[obj[k]] !== 'number');
    const filtered = {};
    for (const k of validKeys) {
        filtered[k] = obj[k];
    }
    return Object.values(filtered);
};
const isNodeServer = () => {
    try {
        return Boolean(process?.env);
    }
    catch {
        return false;
    }
};
const tryImportModule = async (id, importMeta) => {
    if (!isNodeServer())
        return null;
    const { default: { createRequire }, } = await import('node:module');
    if (!createRequire)
        return null;
    const require$1 = createRequire(importMeta.url);
    try {
        const modulePath = require$1.resolve(id);
        // eslint-disable-next-line import/no-dynamic-require
        return { module: require$1(modulePath) };
    }
    catch {
        return null;
    }
};

const isZodType = (schema, typeName) => {
    const constructorName = schema.constructor.name;
    if (constructorName === typeName) {
        return true;
    }
    // Also check _def.typeName which is more reliable in some environments (like Bun or minified code)
    return schema._def?.typeName === typeName;
};
const unwrapZodSchema = (schema, options = {}, _features = {}) => {
    const monTypeOptions = schema._def[MongooseTypeOptionsSymbol];
    _features.mongooseTypeOptions ||= monTypeOptions;
    const monSchemaOptions = schema._def[MongooseSchemaOptionsSymbol];
    _features.mongooseSchemaOptions ||= monSchemaOptions;
    if (isZodType(schema, 'ZodUnion')) {
        const unionSchemaTypes = schema._def.options.map((v) => v.constructor.name);
        if (new Set(unionSchemaTypes).size === 1) {
            _features.unionSchemaType ??= unionSchemaTypes[0];
        }
    }
    if (schema instanceof ZodMongoose) {
        return unwrapZodSchema(schema._def.innerType, options, {
            ..._features,
            mongoose: schema._def.mongoose,
        });
    }
    // Remove `strict` or `passthrough` feature - set to strip mode (default)
    if (isZodType(schema, 'ZodObject')) {
        const unknownKeys = schema._def.unknownKeys;
        if (unknownKeys === 'strict' || unknownKeys === 'passthrough') {
            return unwrapZodSchema(schema.strip(), options, { ..._features, unknownKeys });
        }
    }
    if (isZodType(schema, 'ZodOptional')) {
        return unwrapZodSchema(schema.unwrap(), options, { ..._features, isOptional: true });
    }
    if (isZodType(schema, 'ZodDefault')) {
        return unwrapZodSchema(schema._def.innerType, options, 
        // Only top-most default value ends up being used
        // (in case of `<...>.default(1).default(2)`, `2` will be used as the default value)
        'default' in _features ? _features : { ..._features, default: schema._def.defaultValue() });
    }
    if (isZodType(schema, 'ZodBranded') || isZodType(schema, 'ZodNullable')) {
        return unwrapZodSchema(schema.unwrap(), options, { ..._features });
    }
    if (isZodType(schema, 'ZodEffects') && schema._def.effect.type === 'refinement') {
        return unwrapZodSchema(schema._def.schema, options, _features);
    }
    // unwrap special ZodEffect of preprocess with description "ObjectId", unwrap will trigger if above this one.
    // It will fix string input to ObjectId conversion if used with:
    // export const getZodObjectIdField = () => z.preprocess(
    //   v => (typeof v === 'string' && v.match(/^[a-f\d]{24}$/i) ? new Types.ObjectId(v) : v),
    //   mongooseZodCustomType('ObjectId').describe('ObjectId')
    // )
    if (isZodType(schema, 'ZodEffects') &&
        schema._def.effect.type === 'preprocess' &&
        schema._def.schema.description === 'ObjectId') {
        return unwrapZodSchema(schema._def.schema, options, _features);
    }
    if (isZodType(schema, 'ZodArray') && !options.doNotUnwrapArrays) {
        const wrapInArrayTimes = Number(_features.array?.wrapInArrayTimes || 0) + 1;
        return unwrapZodSchema(schema._def.type, options, {
            ..._features,
            array: {
                ..._features.array,
                wrapInArrayTimes,
                originalArraySchema: _features.array?.originalArraySchema || schema,
            },
        });
    }
    return { schema, features: _features };
};

const zodInstanceofOriginalClasses = new WeakMap();
const mongooseZodCustomType = (typeName, params) => {
    const instanceClass = typeName === 'Buffer' ? Buffer : M.Types[typeName];
    const typeClass = M.Schema.Types[typeName];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const result = z.z.instanceof(instanceClass, params);
    zodInstanceofOriginalClasses.set(result._def.schema, typeClass);
    result._def.mongooseZodCustomType = typeClass;
    return result;
};

const { Mixed: MongooseMixed } = M.Schema.Types;
registerCustomMongooseZodTypes();
// eslint-disable-next-line
const getFixedOptionFn = (fn) => function (...args) {
    const thisFixed = this && this instanceof M.Document ? this : undefined;
    return fn.apply(thisFixed, args);
};
const getStrictOptionValue = (unknownKeys, schemaFeatures) => {
    const isStrictThrow = unknownKeys == null || unknownKeys === 'throw' || schemaFeatures.unknownKeys === 'strict';
    const isStrictFalse = unknownKeys === 'strip-unless-overridden' && schemaFeatures.unknownKeys === 'passthrough';
    return isStrictThrow ? 'throw' : !isStrictFalse;
};
const addMongooseSchemaFields = (zodSchema, monSchema, context) => {
    const { fieldsStack = [], monSchemaOptions, monTypeOptions: monTypeOptionsFromSchema, unknownKeys, } = context;
    const addToField = fieldsStack.at(-1);
    const fieldPath = fieldsStack.join('.');
    const isRoot = addToField == null;
    const throwError = (message, noPath) => {
        throw new MongooseZodError(`${`Path \`${fieldPath}\`: `}${message}`);
    };
    const { schema: zodSchemaFinal, features: schemaFeatures } = unwrapZodSchema(zodSchema);
    const monMetadata = schemaFeatures.mongoose || {};
    const { mongooseTypeOptions: monTypeOptionsFromField, mongooseSchemaOptions: monSchemaOptionsFromField, unionSchemaType, } = schemaFeatures;
    const monTypeOptions = { ...monTypeOptionsFromField, ...monTypeOptionsFromSchema };
    const isRequired = !schemaFeatures.isOptional && !isZodType(zodSchemaFinal, 'ZodNull');
    const isFieldArray = 'array' in schemaFeatures;
    const mzOptions = [
        ['validate', monTypeOptions.mzValidate],
        ['required', monTypeOptions.mzRequired],
    ];
    mzOptions.forEach(([origName]) => {
        const mzName = `mz${origName[0]?.toUpperCase()}${origName.slice(1)}`;
        if (mzName in monTypeOptions) {
            if (origName in monTypeOptions) {
                throwError(`Can't have both "${mzName}" and "${origName}" set`);
            }
            monTypeOptions[origName] = monTypeOptions[mzName];
            delete monTypeOptions[mzName];
        }
    });
    const commonFieldOptions = {
        required: isRequired,
        ...('default' in schemaFeatures
            ? { default: schemaFeatures.default }
            : // `mongoose-lean-defaults` will implicitly set default values on sub schemas.
                // It will result in sub documents being ALWAYS defined after using `.lean()`
                // and even optional fields of that schema having `undefined` values.
                // This looks very weird to me and even broke my production.
                // You need to explicitly set `default: undefined` to sub schemas to prevent such a behaviour.
                isFieldArray || isZodType(zodSchemaFinal, 'ZodObject')
                    ? { default: undefined }
                    : {}),
        ...(isFieldArray && { castNonArrays: false }),
        ...monTypeOptions,
    };
    const [[, mzValidate], [, mzRequired]] = mzOptions;
    if (mzValidate != null) {
        let mzv = mzValidate;
        if (typeof mzv === 'function') {
            mzv = getFixedOptionFn(mzv);
        }
        else if (!Array.isArray(mzv) && typeof mzv === 'object' && !(mzv instanceof RegExp)) {
            mzv.validator = getFixedOptionFn(mzv.validator);
        }
        else if (Array.isArray(mzv) && !(mzv[0] instanceof RegExp && typeof mzv[1] === 'string')) {
            const [firstElem, secondElem] = mzv;
            if (typeof firstElem === 'function' && typeof secondElem === 'string') {
                commonFieldOptions.mzValidate = [getFixedOptionFn(firstElem), secondElem];
            }
        }
        commonFieldOptions.validate = mzv;
    }
    if (mzRequired != null) {
        let mzr = mzRequired;
        if (typeof mzr === 'function') {
            mzr = getFixedOptionFn(mzr);
        }
        else if (Array.isArray(mzr) && typeof mzr[0] === 'function') {
            const [probablyFn] = mzr;
            if (typeof probablyFn === 'function') {
                mzr[0] = getFixedOptionFn(probablyFn);
            }
        }
        commonFieldOptions.required = mzr;
    }
    if (isRequired) {
        // eslint-disable-next-line no-lonely-if
        if (commonFieldOptions.required !== true) {
            throwError("Can't have `required` set to anything but true if `.optional()` not used");
        }
    }
    else if (commonFieldOptions.required === true) {
        throwError("Can't have `required` set to true and `.optional()` used");
    }
    let fieldType;
    let errMsgAddendum = '';
    const typeKey = (isRoot ? monSchemaOptions?.typeKey : context.typeKey) ?? 'type';
    if (isZodType(zodSchemaFinal, 'ZodObject')) {
        const relevantSchema = isRoot
            ? monSchema
            : new M.Schema({}, {
                strict: getStrictOptionValue(unknownKeys, schemaFeatures),
                ...monSchemaOptionsFromField,
                typeKey,
                ...monMetadata?.schemaOptions,
            });
        for (const [key, S] of Object.entries(zodSchemaFinal._def.shape())) {
            addMongooseSchemaFields(S, relevantSchema, {
                ...context,
                fieldsStack: [...fieldsStack, key],
                monTypeOptions: monMetadata.typeOptions?.[key],
                typeKey: monMetadata?.schemaOptions?.typeKey ?? typeKey,
            });
        }
        if (isRoot) {
            return;
        }
        if (!('_id' in commonFieldOptions)) {
            commonFieldOptions._id = false;
        }
        fieldType = relevantSchema;
    }
    else if (isZodType(zodSchemaFinal, 'ZodNumber') || unionSchemaType === 'ZodNumber') {
        fieldType = MongooseZodNumber;
    }
    else if (isZodType(zodSchemaFinal, 'ZodString') || unionSchemaType === 'ZodString') {
        fieldType = MongooseZodString;
    }
    else if (isZodType(zodSchemaFinal, 'ZodDate') || unionSchemaType === 'ZodDate') {
        fieldType = MongooseZodDate;
    }
    else if (isZodType(zodSchemaFinal, 'ZodBigInt') || unionSchemaType === 'ZodBigInt') {
        fieldType = MongooseZodBigInt;
    }
    else if (isZodType(zodSchemaFinal, 'ZodBoolean') || unionSchemaType === 'ZodBoolean') {
        fieldType = MongooseZodBoolean;
    }
    else if (isZodType(zodSchemaFinal, 'ZodLiteral')) {
        const literalValue = zodSchemaFinal._def.value;
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
                if (!literalValue) {
                    fieldType = MongooseMixed;
                }
                errMsgAddendum = 'object literals are not supported';
                break;
            }
            default: {
                errMsgAddendum = 'only boolean, number, bigint, string or null literals are supported';
            }
        }
    }
    else if (isZodType(zodSchemaFinal, 'ZodEnum')) {
        const enumValues = zodSchemaFinal._def.values;
        if (Array.isArray(enumValues) &&
            enumValues.length > 0 &&
            enumValues.every((v) => typeof v === 'string')) {
            fieldType = MongooseZodString;
        }
        else {
            errMsgAddendum = 'only nonempty zod enums with string values are supported';
        }
    }
    else if (isZodType(zodSchemaFinal, 'ZodNativeEnum')) {
        const enumValues = getValidEnumValues(zodSchemaFinal._def.values);
        const valuesJsTypes = [...new Set(enumValues.map((v) => typeof v))];
        if (valuesJsTypes.length === 1 && valuesJsTypes[0] === 'number') {
            fieldType = MongooseZodNumber;
        }
        else if (valuesJsTypes.length === 1 && valuesJsTypes[0] === 'bigint') {
            fieldType = MongooseZodBigInt;
        }
        else if (valuesJsTypes.length === 1 && valuesJsTypes[0] === 'string') {
            fieldType = MongooseZodString;
        }
        else if (valuesJsTypes.length >= 2 &&
            valuesJsTypes.every((t) => ['string', 'number', 'bigint'].includes(t))) {
            fieldType = MongooseMixed;
        }
        else {
            errMsgAddendum =
                'only nonempty native enums with number, bigint and strings values are supported';
        }
    }
    else if (isZodType(zodSchemaFinal, 'ZodDiscriminatedUnion') ||
        isZodType(zodSchemaFinal, 'ZodIntersection')) {
        fieldType = MongooseMixed;
    }
    else if (isZodType(zodSchema, 'ZodNaN') ||
        isZodType(zodSchemaFinal, 'ZodNaN') ||
        isZodType(zodSchema, 'ZodNull') ||
        isZodType(zodSchemaFinal, 'ZodNull') ||
        isZodType(zodSchemaFinal, 'ZodUnknown') ||
        isZodType(zodSchemaFinal, 'ZodRecord') ||
        isZodType(zodSchemaFinal, 'ZodUnion') ||
        isZodType(zodSchemaFinal, 'ZodTuple')) {
        fieldType = MongooseMixed;
    }
    else if (isZodType(zodSchemaFinal, 'ZodAny')) {
        const instanceOfClass = zodInstanceofOriginalClasses.get(zodSchemaFinal);
        fieldType = instanceOfClass || MongooseMixed;
        // When using .lean(), it returns the inner representation of buffer fields, i.e.
        // instances of `mongo.Binary`. We can fix this with the getter that actually returns buffers
        if (instanceOfClass === M.Schema.Types.Buffer && !('get' in commonFieldOptions)) {
            commonFieldOptions.get = bufferMongooseGetter;
        }
    }
    else if (isZodType(zodSchemaFinal, 'ZodMap')) {
        fieldType = Map;
    }
    else if (isZodType(zodSchemaFinal, 'ZodEffects') && // `refinement` effects are already unwrapped at this stage
        zodSchemaFinal._def.effect.type !== 'refinement') {
        errMsgAddendum = 'only refinements are supported';
    }
    if (isRoot) {
        throw new MongooseZodError('You must provide object schema at root level');
    }
    // undefined, void, bigint, never, sets, promise, function, lazy, effects
    if (fieldType == null) {
        if (zodSchemaFinal._def.mongooseZodCustomType) {
            fieldType = zodSchemaFinal._def.mongooseZodCustomType;
        }
        else {
            const typeName = zodSchemaFinal._def.typeName || zodSchemaFinal.constructor.name;
            throwError(`${typeName} type is not supported${errMsgAddendum ? ` (${errMsgAddendum})` : ''}`);
        }
    }
    if (schemaFeatures.array) {
        for (let i = 0; i < schemaFeatures.array.wrapInArrayTimes; i++) {
            fieldType = [fieldType];
        }
    }
    monSchema.add({
        [addToField]: {
            ...commonFieldOptions,
            [typeKey]: fieldType,
        },
    });
    monSchema.paths[addToField]?.validate(function (value) {
        let schemaToValidate = schemaFeatures.array?.originalArraySchema || zodSchemaFinal;
        if (isZodType(schemaToValidate, 'ZodObject')) {
            schemaToValidate = z.preprocess((obj) => {
                if (!obj || typeof obj !== 'object') {
                    return obj;
                }
                // Do not shallow-copy the object until we find Binary we need to unwrap
                let objMaybeCopy = obj;
                for (const [k, v] of Object.entries(objMaybeCopy)) {
                    if (M.mongo && v instanceof M.mongo.Binary) {
                        if (objMaybeCopy === obj) {
                            objMaybeCopy = { ...obj };
                        }
                        objMaybeCopy[k] = v.buffer;
                    }
                }
                return objMaybeCopy;
            }, schemaToValidate);
        }
        const valueToParse = value &&
            typeof value === 'object' &&
            'toObject' in value &&
            typeof value.toObject === 'function'
            ? value.toObject()
            : value;
        return schemaToValidate.parse(valueToParse), true;
    });
};
const isPluginDisabled = (name, option) => option != null && (option === true || option[name]);
const ALL_PLUGINS_DISABLED = {
    leanDefaults: true,
    leanGetters: true,
    leanVirtuals: true,
};
let mlvPlugin = null;
let mldPlugin = null;
let mlgPlugin = null;
// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {
    if (isNodeServer()) {
        mlvPlugin = await tryImportModule('mongoose-lean-virtuals', ({ url: (typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href)) }));
        mldPlugin = await tryImportModule('mongoose-lean-defaults', ({ url: (typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href)) }));
        mlgPlugin = await tryImportModule('mongoose-lean-getters', ({ url: (typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href)) }));
    }
})();
const toMongooseSchema = (rootZodSchema, options = {}) => {
    if (!(rootZodSchema instanceof ZodMongoose)) {
        throw new MongooseZodError('Root schema must be an instance of ZodMongoose');
    }
    const globalOptions = setupState.options?.defaultToMongooseSchemaOptions || {};
    const optionsFinal = {
        ...globalOptions,
        ...options,
        disablePlugins: {
            ...(globalOptions.disablePlugins === true
                ? { ...ALL_PLUGINS_DISABLED }
                : globalOptions.disablePlugins),
            ...(options.disablePlugins === true ? { ...ALL_PLUGINS_DISABLED } : options.disablePlugins),
        },
    };
    const { disablePlugins: dp, unknownKeys } = optionsFinal;
    const metadata = rootZodSchema._def;
    const schemaOptionsFromField = metadata.innerType._def?.[MongooseSchemaOptionsSymbol];
    const schemaOptions = metadata?.mongoose.schemaOptions;
    const addMLVPlugin = mlvPlugin && !isPluginDisabled('leanVirtuals', dp);
    const addMLDPlugin = mldPlugin && !isPluginDisabled('leanDefaults', dp);
    const addMLGPlugin = mlgPlugin && !isPluginDisabled('leanGetters', dp);
    const schema = new M.Schema({}, {
        id: false,
        minimize: false,
        strict: getStrictOptionValue(unknownKeys, unwrapZodSchema(rootZodSchema).features),
        ...schemaOptionsFromField,
        ...schemaOptions,
        query: {
            lean(leanOptions) {
                return M.Query.prototype.lean.call(this, typeof leanOptions === 'object' || leanOptions == null
                    ? {
                        ...(addMLVPlugin && { virtuals: true }),
                        ...(addMLDPlugin && { defaults: true }),
                        ...(addMLGPlugin && { getters: true }),
                        versionKey: false,
                        ...leanOptions,
                    }
                    : leanOptions);
            },
            ...schemaOptions?.query,
        },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore KEIHARDE TS_IGNORE!
    addMongooseSchemaFields(rootZodSchema, schema, { monSchemaOptions: schemaOptions, unknownKeys });
    addMLVPlugin && schema.plugin(mlvPlugin?.module);
    addMLDPlugin && schema.plugin(mldPlugin?.module?.default);
    addMLGPlugin && schema.plugin(mlgPlugin?.module);
    return schema;
};

addMongooseToZodPrototype(z.z);
addMongooseTypeOptionsToZodPrototype(z.z);

Object.defineProperty(exports, "z", {
    enumerable: true,
    get: function () { return z.z; }
});
exports.MongooseSchemaOptionsSymbol = MongooseSchemaOptionsSymbol;
exports.MongooseTypeOptionsSymbol = MongooseTypeOptionsSymbol;
exports.MongooseZodError = MongooseZodError;
exports.ZodMongoose = ZodMongoose;
exports.addMongooseTypeOptions = addMongooseTypeOptions;
exports.bufferMongooseGetter = bufferMongooseGetter;
exports.genTimestampsSchema = genTimestampsSchema;
exports.mongooseZodCustomType = mongooseZodCustomType;
exports.setup = setup;
exports.toMongooseSchema = toMongooseSchema;
exports.toZodMongooseSchema = toZodMongooseSchema;
//# sourceMappingURL=index.cjs.map
