import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import {withMongoose, MongooseMeta} from './registry.js';
import {getFrontendMode} from './config.js';

// Helper to get mongoose types safely without top-level import
const getMongooseTypes = () => {
  try {
    // eslint-disable-next-line global-require
    return require('mongoose');
  } catch {
    return null;
  }
};

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

export const zObjectId = (options?: MongooseMeta) => {
  if (getFrontendMode()) {
    return withMongoose(z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId'), {
      type: 'ObjectId', // String representation for metadata
      ...options,
    });
  }

  const mongoose = getMongooseTypes();

  return withMongoose(
    z.custom<mongoose.Types.ObjectId>(
      (val) =>
        (mongoose && val instanceof mongoose.Types.ObjectId) ||
        (typeof val === 'string' && /^[\dA-Fa-f]{24}$/.test(val)),
    ),
    {
      type: mongoose?.Schema.Types.ObjectId || 'ObjectId',
      ...options,
    },
  );
};

export const zBuffer = (options?: MongooseMeta) => {
  if (getFrontendMode()) {
    return withMongoose(z.instanceof(Uint8Array), {
      type: 'Buffer',
      ...options,
    });
  }

  const mongoose = getMongooseTypes();

  return withMongoose(
    z.custom<Buffer>((val) => (mongoose && val instanceof Buffer) || val instanceof Uint8Array),
    {
      type: mongoose?.Schema.Types.Buffer || 'Buffer',
      ...options,
    },
  );
};

export const zPopulated = <T extends z.ZodTypeAny>(
  ref: string,
  schema: T,
  options?: MongooseMeta,
) => {
  const isFrontend = getFrontendMode();

  const mongoose = getMongooseTypes();

  const objectIdSchema = isFrontend
    ? z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId')
    : z.custom<mongoose.Types.ObjectId>(
        (val) =>
          (mongoose && val instanceof mongoose.Types.ObjectId) ||
          (typeof val === 'string' && /^[\dA-Fa-f]{24}$/.test(val)),
      );

  return withMongoose(z.union([objectIdSchema, schema]), {
    type: isFrontend ? 'ObjectId' : mongoose?.Schema.Types.ObjectId || 'ObjectId',
    ref,
    ...options,
  });
};

const DateFieldZod = () => z.date().default(() => new Date());

export const genTimestampsSchema = <CrAt = 'createdAt', UpAt = 'updatedAt'>(
  createdAtField: StringLiteral<CrAt | 'createdAt'> | null = 'createdAt' as any,
  updatedAtField: StringLiteral<UpAt | 'updatedAt'> | null = 'updatedAt' as any,
) => {
  if (
    createdAtField != null &&
    updatedAtField != null &&
    (createdAtField as string) === (updatedAtField as string)
  ) {
    throw new Error('`createdAt` and `updatedAt` fields must be different');
  }

  const shape: any = {};
  if (createdAtField != null) {
    shape[createdAtField as string] = withMongoose(DateFieldZod(), {immutable: true, index: true});
  }
  if (updatedAtField != null) {
    shape[updatedAtField as string] = withMongoose(DateFieldZod(), {index: true});
  }

  const schema = z.object(shape);

  const meta = {
    timestamps: {
      createdAt: createdAtField == null ? false : (createdAtField as string),
      updatedAt: updatedAtField == null ? false : (updatedAtField as string),
    },
  };

  // Attach metadata to the instance if supported, but also register it
  const schemaWithMeta = withMongoose(schema, meta);
  (schemaWithMeta as any).meta = () => meta;

  return schemaWithMeta;
};

export const bufferMongooseGetter = (value: unknown) =>
  value != null && (value as any)._bsontype === 'Binary' ? (value as any).buffer : value;
