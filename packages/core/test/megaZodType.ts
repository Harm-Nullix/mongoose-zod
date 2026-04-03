import {z} from 'zod/v4';
import {zObjectId, zBuffer} from '../src/index.js';

// Setup Enums and Constants for use in the schema
const StatusEnum = z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']);
enum Role {
  Admin,
  User,
  Guest,
}

// Setup a recursive/lazy schema (e.g., category trees or folder structures)
interface CategoryNode {
  id: string;
  subCategories?: CategoryNode[];
}
const categorySchema: z.ZodType<CategoryNode> = z.lazy(
  () =>
    z.object({
      id: z.uuid(),
      subCategories: z.array(categorySchema).optional(),
    }),
  // eslint-disable-next-line
);

// The Mega Zod Object!
export const MegaZodSchema = z.object({
  // --- PRIMITIVES ---
  simpleString: z.string(),
  simpleNumber: z.number(),
  simpleBoolean: z.boolean(),
  simpleDate: z.date(),
  simpleBigInt: z.bigint(),
  simpleSymbol: z.symbol(),
  simpleUndefined: z.undefined(),
  simpleNull: z.null(),
  simpleAny: z.any(),
  simpleUnknown: z.unknown(),

  // --- REFINED STRINGS ---
  email: z.email(),
  url: z.url(),
  uuid: z.uuid(),
  cuid: z.cuid(),
  ipAddress: z.ipv4(),
  ipAddressCidr: z.cidrv4(),
  datetime: z.iso.datetime({offset: true}),
  coolFormat: z.stringFormat(
    'cool-id',
    (val) =>
      // arbitrary validation here
      val.length === 100 && val.startsWith('cool-'),
  ),
  regexValidated: z
    .string()
    .regex(/^[\dA-Za-z]+$/)
    .min(3)
    .max(255)
    .trim()
    .toLowerCase(),

  // --- REFINED NUMBERS ---
  age: z.number().int().positive().min(18).max(120),
  price: z.number().nonnegative().multipleOf(0.01),
  finiteNumber: z.number().int(),

  // --- ENUMS & LITERALS ---
  status: StatusEnum,
  nativeRole: z.enum(Role),
  exactLiteral: z.literal('I_MUST_BE_THIS_STRING'),

  // --- ARRAYS & TUPLES ---
  stringArray: z.array(z.string()),
  chainedArray: z.number().int().array().min(1).max(10), // Alternative syntax
  basicTuple: z.tuple([z.string(), z.number(), z.boolean()]),
  variadicTuple: z.tuple([z.email()]).rest(z.number()), // [email, number, number, ...]

  // --- RECORDS, MAPS, SETS ---
  // A record where keys are strings, values are numbers
  dynamicScores: z.record(z.string(), z.number()),
  // A record where keys MUST be the StatusEnum, and values MUST be emails
  statusContacts: z.record(StatusEnum, z.email()),
  // ES6 Map: UUID keys to strictly shaped objects
  userMap: z.map(z.uuid(), z.object({username: z.string()})),
  // ES6 Set of unique validated strings
  uniqueTags: z.set(z.string().min(2).max(20)),

  // --- UNIONS & INTERSECTIONS ---
  stringOrNumber: z.union([z.string(), z.number()]),
  alternativeUnion: z.email().or(z.uuid()),

  // Combines two object shapes into one
  personWithEmployeeData: z.intersection(
    z.object({firstName: z.string(), lastName: z.string()}),
    z.object({employeeId: z.number().int(), department: z.string()}),
  ),
  alternativeIntersection: z.object({a: z.string()}).and(z.object({b: z.number()})),

  // Discriminated union (very common in API payloads/events)
  eventPayload: z.discriminatedUnion('eventType', [
    z.object({eventType: z.literal('click'), x: z.number(), y: z.number()}),
    z.object({eventType: z.literal('keypress'), key: z.string()}),
  ]),

  // --- WRAPPERS & MODIFIERS ---
  optionalField: z.string().optional(),
  nullableField: z.number().nullable(),
  nullishField: z.boolean().nullish(), // Both optional AND nullable
  defaultField: z.string().default('anonymous'),
  // eslint-disable-next-line unicorn/prefer-top-level-await
  catchField: z.number().catch(0), // Falls back to 0 if validation fails
  readonlyField: z.string().readonly(), // Marks the TS output as readonly

  // --- REFINEMENTS, TRANSFORMS, & PIPELINES ---
  // Validates, but allows custom logic
  customValidated: z.string().refine((val) => val.includes('zod'), {
    message: "Must contain the word 'zod'",
  }),
  // Modifies the data during parsing (e.g., string -> number)
  transformed: z.string().transform((val) => val.length),
  // Branded types for TS nominal typing (e.g., ensuring a string is a UserId)
  brandedId: z.uuid().brand<'UserId'>(),

  // --- PROMISES, FUNCTIONS, & INSTANCES ---
  promiseData: z.promise(z.string()),
  functionValidator: z.function({
    input: [
      z.object({
        name: z.string(),
        age: z.number().int(),
      }),
    ],
    output: z.string(),
  }),
  dateInstance: z.instanceof(Date),

  // --- RECURSIVE ---
  categoryTree: categorySchema,

  // ====================================================================
  // --- THE DEEP WEIRD STUFF (Combinations) ---
  // ====================================================================

  // An array of arrays, containing unions of sets and records!
  matrixOfMadness: z
    .array(
      z
        .array(
          z.union([z.set(z.number()), z.record(z.enum(['x', 'y', 'z']), z.boolean().nullable())]),
        )
        .min(2),
    )
    .optional(),

  // A record where the key is an enum, and the value is a discriminated union
  // inside an array, wrapped in a catch!
  stateMachineEvents: z.record(
    StatusEnum,
    z
      .array(
        z.discriminatedUnion('type', [
          z.object({type: z.literal('start'), time: z.date()}),
          z.object({type: z.literal('error'), code: z.number()}),
        ]),
      )
      // eslint-disable-next-line unicorn/prefer-top-level-await
      .catch([]),
  ),

  _id: zObjectId(),
  refs: z.array(zObjectId()),
  buffer: zBuffer(),
});

// Extracting the TypeScript type just to prove it compiles into a massive TS definition
export type MegaZodType = z.infer<typeof MegaZodSchema>;
