import { z } from 'zod/v4';

//#region src/utils.ts
function flatHooks(configHooks, hooks = {}, parentName) {
	for (const key in configHooks) {
		const subHook = configHooks[key];
		const name = parentName ? `${parentName}:${key}` : key;
		if (typeof subHook === "object" && subHook !== null) flatHooks(subHook, hooks, name);
		else if (typeof subHook === "function") hooks[name] = subHook;
	}
	return hooks;
}
const createTask = /* @__PURE__ */ (() => {
	if (console.createTask) return console.createTask;
	const defaultTask = { run: (fn) => fn() };
	return () => defaultTask;
})();
function callHooks(hooks, args, startIndex, task) {
	for (let i = startIndex; i < hooks.length; i += 1) try {
		const result = task ? task.run(() => hooks[i](...args)) : hooks[i](...args);
		if (result instanceof Promise) return result.then(() => callHooks(hooks, args, i + 1, task));
	} catch (error) {
		return Promise.reject(error);
	}
}
function serialTaskCaller(hooks, args, name) {
	if (hooks.length > 0) return callHooks(hooks, args, 0, createTask(name));
}
function parallelTaskCaller(hooks, args, name) {
	if (hooks.length > 0) {
		const task = createTask(name);
		return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
	}
}
function callEachWith(callbacks, arg0) {
	for (const callback of [...callbacks]) callback(arg0);
}
//#endregion
//#region src/hookable.ts
var Hookable = class {
	_hooks;
	_before;
	_after;
	_deprecatedHooks;
	_deprecatedMessages;
	constructor() {
		this._hooks = {};
		this._before = void 0;
		this._after = void 0;
		this._deprecatedMessages = void 0;
		this._deprecatedHooks = {};
		this.hook = this.hook.bind(this);
		this.callHook = this.callHook.bind(this);
		this.callHookWith = this.callHookWith.bind(this);
	}
	hook(name, function_, options = {}) {
		if (!name || typeof function_ !== "function") return () => {};
		const originalName = name;
		let dep;
		while (this._deprecatedHooks[name]) {
			dep = this._deprecatedHooks[name];
			name = dep.to;
		}
		if (dep && !options.allowDeprecated) {
			let message = dep.message;
			if (!message) message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
			if (!this._deprecatedMessages) this._deprecatedMessages = /* @__PURE__ */ new Set();
			if (!this._deprecatedMessages.has(message)) {
				console.warn(message);
				this._deprecatedMessages.add(message);
			}
		}
		if (!function_.name) try {
			Object.defineProperty(function_, "name", {
				get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
				configurable: true
			});
		} catch {}
		this._hooks[name] = this._hooks[name] || [];
		this._hooks[name].push(function_);
		return () => {
			if (function_) {
				this.removeHook(name, function_);
				function_ = void 0;
			}
		};
	}
	hookOnce(name, function_) {
		let _unreg;
		let _function = (...arguments_) => {
			if (typeof _unreg === "function") _unreg();
			_unreg = void 0;
			_function = void 0;
			return function_(...arguments_);
		};
		_unreg = this.hook(name, _function);
		return _unreg;
	}
	removeHook(name, function_) {
		const hooks = this._hooks[name];
		if (hooks) {
			const index = hooks.indexOf(function_);
			if (index !== -1) hooks.splice(index, 1);
			if (hooks.length === 0) this._hooks[name] = void 0;
		}
	}
	clearHook(name) {
		this._hooks[name] = void 0;
	}
	deprecateHook(name, deprecated) {
		this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
		const _hooks = this._hooks[name] || [];
		this._hooks[name] = void 0;
		for (const hook of _hooks) this.hook(name, hook);
	}
	deprecateHooks(deprecatedHooks) {
		for (const name in deprecatedHooks) this.deprecateHook(name, deprecatedHooks[name]);
	}
	addHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		const removeFns = Object.keys(hooks).map((key) => this.hook(key, hooks[key]));
		return () => {
			for (const unreg of removeFns) unreg();
			removeFns.length = 0;
		};
	}
	removeHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		for (const key in hooks) this.removeHook(key, hooks[key]);
	}
	removeAllHooks() {
		this._hooks = {};
	}
	callHook(name, ...args) {
		return this.callHookWith(serialTaskCaller, name, args);
	}
	callHookParallel(name, ...args) {
		return this.callHookWith(parallelTaskCaller, name, args);
	}
	callHookWith(caller, name, args) {
		const event = this._before || this._after ? {
			name,
			args,
			context: {}
		} : void 0;
		if (this._before) callEachWith(this._before, event);
		const result = caller(this._hooks[name] ? [...this._hooks[name]] : [], args, name);
		if (result instanceof Promise) return result.finally(() => {
			if (this._after && event) callEachWith(this._after, event);
		});
		if (this._after && event) callEachWith(this._after, event);
		return result;
	}
	beforeEach(function_) {
		this._before = this._before || [];
		this._before.push(function_);
		return () => {
			if (this._before !== void 0) {
				const index = this._before.indexOf(function_);
				if (index !== -1) this._before.splice(index, 1);
			}
		};
	}
	afterEach(function_) {
		this._after = this._after || [];
		this._after.push(function_);
		return () => {
			if (this._after !== void 0) {
				const index = this._after.indexOf(function_);
				if (index !== -1) this._after.splice(index, 1);
			}
		};
	}
};
function createHooks() {
	return new Hookable();
}

const hooks = createHooks();
/**
 * Synchronous hook caller for Hookable.
 */
function callHookSync(name, ...args) {
    hooks.callHookWith((callbacks, args) => {
        for (const callback of callbacks) {
            callback(...args);
        }
    }, name, args);
}

/**
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
const mongooseRegistry = z.registry();
/**
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
function withMongoose(schema, meta) {
    callHookSync('registry:get:before', { schema });
    const existing = mongooseRegistry.get(schema) || {};
    callHookSync('registry:get', { schema, meta: existing });
    const merged = { ...existing, ...meta };
    callHookSync('registry:add', { schema, meta: merged });
    mongooseRegistry.add(schema, merged);
    callHookSync('registry:added', { schema, meta: merged });
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
    if (!(schema instanceof z.ZodOptional) &&
        !(schema instanceof z.ZodNullable) &&
        !(schema instanceof z.ZodDefault) &&
        def.type !== 'pipe') {
        visited.add(schema);
    }
    if (schema instanceof z.ZodOptional) {
        const inner = schema.unwrap();
        return unwrapZodSchema(
        // @ts-expect-error Zod v4 schema.unwrap() return type mismatch
        inner, {
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

// Helper to get mongoose instance safely
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

/**
 * Helper to map Zod checks (min, max, regex, etc.) to Mongoose Schema properties.
 */
function mapZodChecksToMongoose(checks, mongooseProp) {
    if (!checks || !Array.isArray(checks))
        return;
    for (const check of checks) {
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
    callHookSync('validation:mappers', { checks, mongooseProp });
}

/**
 * Handles ZodObject conversion to Mongoose Schema definition.
 */
function handleObject(unwrapped, mongooseProp, visited, extractMongooseDef) {
    callHookSync('schema:object:before', { schema: unwrapped, mongooseProp, visited });
    const { shape } = unwrapped;
    const objDef = {};
    // We must ensure recursive calls see the current object to break cycles.
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
            if (idMeta.includeId !== true &&
                unwrappedIdMeta.includeId !== true &&
                mongooseProp.includeId !== true) {
                continue;
            }
        }
        const def = extractMongooseDef(shape[key], visited);
        if (typeof def === 'object' && def !== null && !Array.isArray(def)) {
            const { includeId, ...cleanDef } = def;
            objDef[key] = cleanDef;
        }
        else {
            objDef[key] = def;
        }
        callHookSync('schema:object:field', { key, schema: shape[key], objDef, visited });
    }
    // If the developer didn't provide a strict Mongoose type override, return the shape
    let result;
    if (mongooseProp.type) {
        // If there is a type override, merge the object definition into the result
        Object.assign(mongooseProp, objDef);
        result = mongooseProp;
    }
    else {
        Object.assign(mongooseProp, objDef);
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
        result = hasFieldMetadata ? mongooseProp : objDef;
    }
    callHookSync('schema:object:after', { schema: unwrapped, mongooseProp, objDef, result });
    return result;
}
/**
 * Handles ZodArray, ZodSet, and ZodTuple conversion.
 */
function handleArray(unwrapped, mongooseProp, visited, extractMongooseDef) {
    callHookSync('schema:array:before', { schema: unwrapped, mongooseProp, visited });
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
        mongooseProp.type = [innerType];
        // Transfer any metadata from the inner type (like 'ref') to the array definition
        if (typeof innerDef === 'object') {
            Object.assign(mongooseProp, innerDef);
            mongooseProp.type = [innerType]; // Restore type as array
        }
    }
    callHookSync('schema:array:after', { schema: unwrapped, mongooseProp, innerDef });
}
/**
 * Handles ZodRecord and ZodMap conversion.
 */
function handleRecord(unwrapped, mongooseProp, visited, extractMongooseDef) {
    callHookSync('schema:record:before', { schema: unwrapped, mongooseProp, visited });
    const valueType = unwrapped.valueType ||
        unwrapped.valueSchema ||
        unwrapped._def.valueType ||
        unwrapped._def.valueSchema ||
        unwrapped._def.innerType; // For some Zod versions
    let innerDef;
    if (!mongooseProp.type || mongooseProp.type === Map) {
        mongooseProp.type = Map;
        const finalValueType = valueType || unwrapped.valueSchema || unwrapped._def?.valueSchema;
        if (finalValueType) {
            innerDef = extractMongooseDef(finalValueType, visited);
            mongooseProp.of = innerDef.type || innerDef;
        }
    }
    callHookSync('schema:record:after', { schema: unwrapped, mongooseProp, innerDef });
}

/**
 * THE CONVERTER (Safe AST Walker)
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
function extractMongooseDef(schema, visited = new Map()) {
    // Only call converter:before at the very beginning of a run
    if (visited.size === 0) {
        callHookSync('converter:before', { schema: schema, visited });
    }
    callHookSync('converter:start', { schema: schema, visited });
    const { schema: unwrapped, features } = unwrapZodSchema(schema);
    // Pull any explicitly registered Mongoose metadata
    callHookSync('registry:get:before', { schema: schema });
    const meta = mongooseRegistry.get(schema) || {};
    callHookSync('registry:get', { schema: schema, meta });
    callHookSync('registry:get:before', { schema: unwrapped });
    const unwrappedMeta = mongooseRegistry.get(unwrapped) || {};
    callHookSync('registry:get', { schema: unwrapped, meta: unwrappedMeta });
    // If we have a chain of wrappers, collect metadata from all of them.
    let currentMeta = { ...unwrappedMeta, ...meta };
    if (schema._def.innerType) {
        let inner = schema._def.innerType;
        while (inner) {
            callHookSync('registry:get:before', { schema: inner });
            const innerMeta = mongooseRegistry.get(inner);
            callHookSync('registry:get', { schema: inner, meta: innerMeta });
            if (innerMeta) {
                currentMeta = { ...innerMeta, ...currentMeta };
            }
            inner = inner._def?.innerType || inner._def?.schema;
        }
    }
    const mongooseProp = currentMeta;
    callHookSync('converter:unwrapped', {
        schema: schema,
        unwrapped,
        features,
        meta: currentMeta,
        mongooseProp: mongooseProp,
    });
    if (features.isOptional === true && mongooseProp.type && mongooseProp.required !== true) {
        mongooseProp.required = false;
    }
    if (visited.has(unwrapped)) {
        const existing = visited.get(unwrapped);
        if (Object.keys(meta).length > 0) {
            Object.assign(existing, mongooseProp);
        }
        return existing;
    }
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
    mapZodChecksToMongoose(features.checks, mongooseProp);
    const def = unwrapped._def;
    if (!def) {
        callHookSync('converter:after', {
            schema: schema,
            mongooseProp,
        });
        return mongooseProp;
    }
    const { type } = def;
    callHookSync('converter:node', {
        schema: unwrapped,
        mongooseProp,
        type,
    });
    // Handle recursion and specific types via separate handlers
    if (type === 'object') {
        const result = handleObject(unwrapped, mongooseProp, visited, extractMongooseDef);
        callHookSync('converter:after', {
            schema: schema,
            mongooseProp: result,
        });
        if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
            delete result.includeId;
        }
        return result;
    }
    if (type === 'array' || type === 'set' || type === 'tuple') {
        handleArray(unwrapped, mongooseProp, visited, extractMongooseDef);
    }
    if (type === 'record' || type === 'map') {
        handleRecord(unwrapped, mongooseProp, visited, extractMongooseDef);
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
        case 'string':
        case 'number':
        case 'boolean':
        case 'date':
        case 'bigint': {
            if (!mongooseProp.type) {
                if (type === 'bigint') {
                    mongooseProp.type = typeof BigInt === 'undefined' ? Number : BigInt;
                }
                else {
                    const typeMap = {
                        string: String,
                        number: Number,
                        boolean: Boolean,
                        date: Date,
                    };
                    mongooseProp.type = typeMap[type];
                }
            }
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        case 'enum':
        case 'nativeenum':
        case 'native_enum': {
            if (!mongooseProp.type)
                mongooseProp.type = String;
            mongooseProp.enum =
                type === 'enum'
                    ? unwrapped.options || def.values
                    : Object.values(unwrapped.enum || def.values);
            if (mongooseProp.required !== false)
                mongooseProp.required = true;
            break;
        }
        // Do nothing
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
        const result = extractMongooseDef(inner, visited);
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
    callHookSync('converter:after', {
        schema: schema,
        mongooseProp,
    });
    if (typeof mongooseProp === 'object' && mongooseProp !== null && !Array.isArray(mongooseProp)) {
        delete mongooseProp.includeId;
    }
    return mongooseProp;
}

/**
 * Converts a Zod schema to a Mongoose Schema instance.
 */
function toMongooseSchema(schema, options) {
    const { schema: unwrapped } = unwrapZodSchema(schema);
    const meta = mongooseRegistry.get(schema) ||
        mongooseRegistry.get(unwrapped) ||
        schema.meta?.() ||
        unwrapped.meta?.() ||
        {};
    const { plugins, ...schemaOptions } = options || {};
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
        ...schemaOptions,
    };
    let definition = extractMongooseDef(schema);
    // Strip internal includeId metadata that might have leaked into the definition
    if (typeof definition === 'object' && definition !== null) {
        // If it's a top-level object, it might have metadata fields directly
        const { includeId, ...cleanDefinition } = definition;
        definition = cleanDefinition;
        // Also clean any top-level field definitions
        for (const value of Object.values(definition)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                delete value.includeId;
            }
        }
    }
    const mongoose = getMongoose();
    if (!mongoose) {
        throw new Error('Mongoose must be installed to use toMongooseSchema. If you are in an ESM environment, ensure mongoose is loaded.');
    }
    const mongooseSchema = new mongoose.Schema(definition, mergedOptions);
    // Apply plugins if provided in options
    if (plugins && Array.isArray(plugins)) {
        for (const plugin of plugins) {
            mongooseSchema.plugin(plugin);
        }
    }
    // Call schema:created hook
    callHookSync('schema:created', {
        schema,
        mongooseSchema,
        options: mergedOptions,
    });
    return mongooseSchema;
}

const zObjectId = (options) => {
    if (getFrontendMode()) {
        return withMongoose(z.preprocess((val) => (val === null ? undefined : val), z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId')), {
            type: 'ObjectId', // String representation for metadata
            ...options,
        });
    }
    const mongoose = getMongoose();
    return withMongoose(z.preprocess((val) => (val === null ? undefined : val), z.custom((val) => (mongoose && val instanceof mongoose.Types.ObjectId) ||
        (typeof val === 'string' && /^[\dA-Fa-f]{24}$/.test(val)))), {
        type: mongoose?.Schema.Types.ObjectId || 'ObjectId',
        ...options,
    });
};
const zBuffer = (options) => {
    if (getFrontendMode()) {
        return withMongoose(z.instanceof(Uint8Array), {
            type: 'Buffer',
            ...options,
        });
    }
    const mongoose = getMongoose();
    return withMongoose(z.custom((val) => (mongoose && val instanceof Buffer) || val instanceof Uint8Array), {
        type: mongoose?.Schema.Types.Buffer || 'Buffer',
        ...options,
    });
};
const zPopulated = (ref, schema, options) => {
    const isFrontend = getFrontendMode();
    const mongoose = getMongoose();
    const objectIdSchema = isFrontend
        ? z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId')
        : z.custom((val) => (mongoose && val instanceof mongoose.Types.ObjectId) ||
            (typeof val === 'string' && /^[\dA-Fa-f]{24}$/.test(val)));
    return withMongoose(z.union([objectIdSchema, schema]), {
        type: isFrontend ? 'ObjectId' : mongoose?.Schema.Types.ObjectId || 'ObjectId',
        ref,
        ...options,
    });
};
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

export { bufferMongooseGetter, callHookSync, extractMongooseDef, genTimestampsSchema, getFrontendMode, getMongoose, hooks, mongooseRegistry, setFrontendMode, toMongooseSchema, withMongoose, zBuffer, zObjectId, zPopulated };
//# sourceMappingURL=index.js.map
