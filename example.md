```ts
import { z } from 'zod/v4';
import mongoose, { SchemaDefinitionProperty, SchemaOptions } from 'mongoose';

/**
 * 1. DEFINE THE METADATA SHAPE
 * This interface represents all the Mongoose-specific options you want to
 * support, including your custom application flags like `hiddenFromPublic`.
 */
export interface MongooseMeta {
  type?: any; // Override the type (e.g., mongoose.Schema.Types.Mixed)
  required?: boolean;
  unique?: boolean;
  index?: boolean;
  default?: any | (() => any); // Mongoose allows functions for defaults
  validate?: any;

  // Custom application flags
  hiddenFromPublic?: boolean;
  readOnlyForDefaultPatch?: boolean;
  readOnly?: boolean;
  exposeCRUDViaSubRoutes?: boolean;

  // Allow any other custom properties
  [key: string]: any;
}

/**
 * 2. CREATE THE ZOD v4 REGISTRY
 * This securely stores our Mongoose metadata alongside the Zod schema instances
 * without polluting the actual validation logic.
 */
export const mongooseRegistry = z.registry<MongooseMeta>();

/**
 * 3. HELPER FUNCTION
 * A clean wrapper to attach Mongoose metadata to any Zod schema.
 */
export function withMongoose<T extends z.ZodTypeAny>(
  schema: T,
  meta: MongooseMeta
): T {
  mongooseRegistry.add(schema, meta);
  // OR schema.register(mongooseRegistry, meta); ??
  return schema;
}

/**
 * 4. THE CONVERTER (Safe AST Walker)
 * We use safe `instanceof` checks instead of undocumented `._def` properties.
 * We extract the Zod type and merge it with any registered Mongoose metadata.
 */
export function extractMongooseDef(schema: z.ZodTypeAny): SchemaDefinitionProperty<any> {
  // Pull any explicitly registered Mongoose metadata for this schema instance
  const meta = mongooseRegistry.get(schema) || {};
  let mongooseProp: any = { ...meta };

  // 1. Handle Objects (Recursion)
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const objDef: any = {};
    for (const key in shape) {
      objDef[key] = extractMongooseDef(shape[key]);
    }
    // If the developer didn't provide a strict Mongoose type override, return the shape
    if (!mongooseProp.type) return objDef;
  }

  // 2. Handle Arrays
  else if (schema instanceof z.ZodArray) {
    const innerDef = extractMongooseDef(schema.element);
    // If no explicit type override, wrap the inner definition in an array
    if (!mongooseProp.type) {
      mongooseProp.type = [innerDef.type || innerDef];
    }
  }

  // 3. Handle Optionals / Nullables
  else if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    const innerDef = extractMongooseDef(schema.unwrap());
    // Merge inner properties but enforce required: false
    mongooseProp = { ...innerDef, ...mongooseProp, required: false };
  }

  // 4. Handle Primitives (Assign defaults if no explicit meta.type is provided)
  else if (schema instanceof z.ZodString) {
    if (!mongooseProp.type) mongooseProp.type = String;
    if (mongooseProp.required !== false) mongooseProp.required = true;
  }
  else if (schema instanceof z.ZodNumber) {
    if (!mongooseProp.type) mongooseProp.type = Number;
    if (mongooseProp.required !== false) mongooseProp.required = true;
  }
  else if (schema instanceof z.ZodBoolean) {
    if (!mongooseProp.type) mongooseProp.type = Boolean;
    if (mongooseProp.required !== false) mongooseProp.required = true;
  }
  else if (schema instanceof z.ZodDate) {
    if (!mongooseProp.type) mongooseProp.type = Date;
    if (mongooseProp.required !== false) mongooseProp.required = true;
  }

  // Fallback for z.any() or unhandled types
  if (!mongooseProp.type && !(schema instanceof z.ZodObject)) {
    mongooseProp.type = mongoose.Schema.Types.Mixed;
  }

  return mongooseProp;
}

// second way of handling it, more core and fail safe:
type AnyDef = Record<string, any>;

export function extractMongooseDef(schema: z.ZodType): AnyDef {
  const meta = mongooseRegistry.get(schema) ?? {};

  // --- object (nested schema)
  if (schema instanceof (z as any).ZodObject) {
    const shape = (schema as any).shape; // fastest-path: relies on runtime API
    const out: AnyDef = {};
    for (const key of Object.keys(shape)) out[key] = extractMongooseDef(shape[key]);

    // allow explicit override to force `{ type: ... }` wrapping
    if (meta.type) return { ...out, ...meta };
    return { ...out, ...meta };
  }

  // --- array
  if (schema instanceof (z as any).ZodArray) {
    const element = (schema as any).element;
    const inner = extractMongooseDef(element);
    const base = { type: [inner.type ?? inner] };
    return { ...base, ...meta };
  }

  // --- optional / nullable
  if (schema instanceof (z as any).ZodOptional || schema instanceof (z as any).ZodNullable) {
    const inner = extractMongooseDef((schema as any).unwrap());
    const base = { ...inner, required: false };
    return { ...base, ...meta, required: false };
  }

  // --- primitives
  if (schema instanceof (z as any).ZodString) {
    const base = { type: String, required: meta.required ?? true };
    return { ...base, ...meta };
  }

  if (schema instanceof (z as any).ZodNumber) {
    const base = { type: Number, required: meta.required ?? true };
    return { ...base, ...meta };
  }

  if (schema instanceof (z as any).ZodBoolean) {
    const base = { type: Boolean, required: meta.required ?? true };
    return { ...base, ...meta };
  }

  if (schema instanceof (z as any).ZodDate) {
    const base = { type: Date, required: meta.required ?? true };
    return { ...base, ...meta };
  }

  // ZodRecord (fast-path fallback)
  if (schema instanceof (z as any).ZodRecord) {
    return { type: mongoose.Schema.Types.Mixed, ...meta };
  }

  // fallback
  const base = { type: (mongoose as any).Schema?.Types?.Mixed };
  return { ...base, ...meta };
}

/**
 * 5. COMPILE TO SCHEMA
 */
export function toMongooseSchema<T>(
  zodSchema: z.ZodObject<any>,
  schemaOptions?: SchemaOptions
): mongoose.Schema<T> {
  const definition = extractMongooseDef(zodSchema);
  return new mongoose.Schema<T>(definition, schemaOptions);
}

// ============================================================================
// USAGE EXAMPLE (Matching your exact requested output shape)
// ============================================================================
import { v4 as uuidv4 } from 'uuid'; // mock
const rolesSchema = new mongoose.Schema({}); // mock
const userDayOffSchema = new mongoose.Schema({}); // mock
const validator = { isEmail: (v: string) => true }; // mock
const RandomPasswordGenerator = (len: number, special: boolean) => "pass"; // mock

// 1. Define the Zod Schema utilizing the registry helper
const UserZodSchema = z.object({
  _id: withMongoose(z.string(), { type: String, required: false }),

  email: withMongoose(z.string(), {
    required: true,
    validate: { validator: async (v: string) => validator.isEmail(v) },
    readOnlyForDefaultPatch: true,
    hiddenFromPublic: true
  }),

  displayName: withMongoose(z.string(), {
    readOnlyForDefaultPatch: true
  }),

  inviteRedeemUrl: withMongoose(z.string().optional(), {
    hiddenFromPublic: true
  }),

  roles: withMongoose(z.array(z.any()), {
    type: [rolesSchema],
    default: [],
    hiddenFromPublic: true
  }),

  frontendSettings: withMongoose(z.any(), {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    hiddenFromPublic: true
  }),

  onBoardingRequired: withMongoose(z.boolean().optional(), {
    type: mongoose.Schema.Types.Boolean
  }),

  apiKey: withMongoose(z.string(), {
    hiddenFromPublic: true,
    default: () => RandomPasswordGenerator(64, false)
  }),

  apiKeyWhitelist: withMongoose(z.array(z.string()), {
    hiddenFromPublic: true,
    default: () => []
  }),

  calendarUuid: withMongoose(z.string(), {
    hiddenFromPublic: true,
    unique: true,
    default: () => uuidv4()
  }),

  lastActivity: withMongoose(z.date().optional(), {
    index: true,
    readOnly: true,
    hiddenFromPublic: true
  }),

  capabilities: withMongoose(z.array(z.string()), {
    hiddenFromPublic: true,
    default: () => []
  }),

  daysOff: withMongoose(z.array(z.any()).optional(), {
    type: [userDayOffSchema],
    default: () => [],
    exposeCRUDViaSubRoutes: true
  }),

  removed: withMongoose(z.boolean(), {
    type: mongoose.Schema.Types.Boolean,
    default: false,
    index: true
  })
});

// 2. Extract into Intermediate Representation (IR) if you want to inspect it
const definition = extractMongooseDef(UserZodSchema);
// console.dir(definition, { depth: null }); // This will exactly match your requested Mongoose object shape

// 3. Generate final model
const schemaOptions: SchemaOptions = { timestamps: true };
export const UserModel = mongoose.model('User', toMongooseSchema(UserZodSchema, schemaOptions));
```

Valid in zod v4:
schema.shape / schema.element / unwrap()

What I can provide (reliably, with what’s documented in the sources) are two workable fastest-path designs that avoid undocumented internals:
Option A (recommended): Registry-first for “hard” types; walker for “easy” types

    Keep your instanceof walker for the primitives you already mapped (string/number/boolean/date), arrays, objects, optional/nullable.
    For z.enum, z.literal, z.bigint, z.record, and any other “special” type, require the user (or your helper) to attach explicit Mongoose metadata via withMongoose(...).
    This is fully compatible with Zod v4 registries: schemas can be registered, looked up, and removed; metadata is strongly typed; .register() returns the original schema instance.1

Minimal pattern:

ts
import * as z from "zod";

type MongooseMeta = { type?: unknown; enum?: unknown[]; required?: boolean; [k: string]: unknown };
const mongooseRegistry = z.registry<MongooseMeta>();

const withMongoose = <T extends z.ZodType>(schema: T, meta: MongooseMeta) =>
schema.register(mongooseRegistry, meta);

// enum/literal/bigint handled by explicit meta
const Status = withMongoose(z.enum(["active", "pending"]), { type: String, enum: ["active", "pending"] });
const Kind = withMongoose(z.literal("user"), { type: String, enum: ["user"] });
const Big = withMongoose(z.bigint(), { type: String }); // you choose storage

This uses only documented registry behavior.1
Option B: JSON Schema as IR, then generate Mongoose-ish output

Zod v4 can convert schemas to JSON Schema via z.toJSONSchema(). That gives you a stable intermediate form for many constructs and avoids poking at Zod internals. It also clearly calls out unrepresentable types like z.bigint() (conversion throws by default, or you can set unrepresentable: "any" to get {} instead).2

Sketch:

ts
import * as z from "zod";

const js = z.toJSONSchema(mySchema, { unrepresentable: "any" });

Then you map JSON Schema type, enum, oneOf, properties, items, etc. to your Mongoose definition shape, and overlay your registry metadata where needed.21