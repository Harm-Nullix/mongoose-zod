# mongoose-zod

A library which allows to author [mongoose](https://github.com/Automattic/mongoose) ("a MongoDB object modeling tool") schemas using [zod](https://github.com/colinhacks/zod) ("a TypeScript-first schema declaration and validation library").

## Purpose

Declaring mongoose schemas in TypeScript environment has always been tricky in terms of getting the most out of type safety:
* You either have to first declare an interface representing a document in MongoDB and then create a schema corresponding to that interface (you get no type safety at all - even the offical mongoose documentation says that "you as the developer are responsible for ensuring that your document interface lines up with your Mongoose schema")
* Or reverse things by using `mongoose.InferSchemaType<typeof schema>` which is far from ideal (impossible to narrow types, doesn't support TS enums, doesn't know about virtuals, has problems with fields named `type`, ...)
* Finally, you can use [typegoose](https://github.com/typegoose/typegoose) which is based on legacy decorators proposal and generally poorly infers types.

This library aims to solve many of the aforementioned problems utilizing `zod` as a schema authoring tool.

### Zod v4 & Mongoose 8 Support

This package is now optimized for **Zod v4** and **Mongoose 8**.

Key features:
- **Registry-based metadata**: Securely store Mongoose-specific metadata alongside Zod schemas using `z.registry`.
- **Transformation Pipelines**: Automatically unwraps `.transform()`, `.pipe()`, `.preprocess()`, and `.refine()` to find the underlying Mongoose type.
- **Native BigInt**: Maps Zod `bigint` to native Mongoose `BigInt`.
- **Specialized Types**: Direct support for `Buffer` and `ObjectId` via `z.instanceof()`.

## Installation

Install the package from [npm](https://www.npmjs.com/package/mongoose-zod):

```shell
npm i mongoose-zod
```

### Peer Dependencies

This package requires `mongoose` (^8.x) and `zod` (^4.x). Note that `zod` imports should be from `zod/v4` to ensure compatibility.

## Usage

### Basic Conversion

```typescript
import { z } from 'zod/v4';
import { toMongooseSchema } from 'mongoose-zod';

const zodSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  age: z.number().optional(),
});

const mongooseSchema = toMongooseSchema(zodSchema);
```

### Adding Mongoose Metadata

Use `withMongoose` to add Mongoose-specific field options like `unique`, `index`, or `required`.

```typescript
import { z } from 'zod/v4';
import { toMongooseSchema, withMongoose } from 'mongoose-zod';

const zodSchema = z.object({
  username: withMongoose(z.string(), { 
    unique: true, 
    index: true,
    lowercase: true 
  }),
  // Default values set with zod's .default() are respected
  roles: z.array(z.string()).default(['user']),
});

const mongooseSchema = toMongooseSchema(zodSchema);
```

### Timestamps

The `genTimestampsSchema` helper simplifies creating Mongoose-compatible Zod schemas with timestamp support.

```typescript
import { z } from 'zod/v4';
import { toMongooseSchema, genTimestampsSchema } from 'mongoose-zod';

const userSchema = z.object({
  name: z.string(),
})
.merge(genTimestampsSchema());

const mongooseSchema = toMongooseSchema(userSchema);
// Mongoose schema will have { timestamps: true } automatically.
```

### Buffers and ObjectIds

```typescript
import { z } from 'zod/v4';
import mongoose from 'mongoose';
import { toMongooseSchema } from 'mongoose-zod';

const schema = z.object({
  avatar: z.instanceof(Buffer),
  ownerId: z.instanceof(mongoose.Types.ObjectId),
});

const mongooseSchema = toMongooseSchema(schema);
```

## API Reference

### `toMongooseSchema(zodSchema, options?)`
Converts a Zod schema to a Mongoose schema.
- `zodSchema`: A Zod object or any Zod type.
- `options`: Optional Mongoose `SchemaOptions`.

### `withMongoose(zodSchema, metadata)`
Attaches Mongoose metadata to a Zod schema instance via the registry.
- `metadata`: Object containing Mongoose field options (`unique`, `index`, `default`, etc.).

### `genTimestampsSchema(createdAtField?, updatedAtField?)`
Returns a Zod object with timestamp fields.
- Default fields are `createdAt` and `updatedAt`.
- Pass `null` to disable a specific field.

---

## Deprecated

The following features from older versions of `mongoose-zod` (Mongoose 7 / Zod 3) are no longer supported or have changed:

- **`setup({ z })`**: No longer required. The library uses the `zod/v4` registry directly and does not modify the Zod prototype.
- **`.mongoose()`, `.mongooseTypeOptions()`, `.mongooseSchemaOptions()`**: These prototype extensions are deprecated. Use `withMongoose()` instead.
- **`mongooseZodCustomType()`**: Use `z.instanceof(Buffer)` or `z.instanceof(mongoose.Types.ObjectId)` for standard specialized types.
- **`toZodMongooseSchema()`**: Use `toMongooseSchema()` instead.
- **Automatic Plugin Loading**: Optional peer dependencies like `mongoose-lean-*` are no longer automatically attached. Plugins should be applied to the Mongoose schema manually.
- **`ZodMongoose` class**: Replaced by standard Zod types with registry-stored metadata.
