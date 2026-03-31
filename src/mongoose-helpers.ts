import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import {withMongoose, MongooseMeta} from './registry.js';
import {getFrontendMode, getMongoose} from './config.js';

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

export const zObjectId = (options?: MongooseMeta) => {
  if (getFrontendMode()) {
    return withMongoose(
      z.preprocess(
        (val) => (val === null ? undefined : val),
        z.string().regex(/^[\dA-Fa-f]{24}$/, 'Invalid ObjectId'),
      ),
      {
        type: 'ObjectId', // String representation for metadata
        ...options,
      },
    );
  }

  const mongoose = getMongoose();

  return withMongoose(
    z.preprocess(
      (val) => (val === null ? undefined : val),
      z.custom<mongoose.Types.ObjectId>(
        (val) =>
          (mongoose && val instanceof mongoose.Types.ObjectId) ||
          (typeof val === 'string' && /^[\dA-Fa-f]{24}$/.test(val)),
      ),
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

  const mongoose = getMongoose();

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

  const mongoose = getMongoose();

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

/**
 * Utility type to extract the populated object type from a Zod schema field
 * that uses `zPopulated`. It excludes string and ObjectId from the union,
 * assuming the field is already populated.
 */
export type PopulatedSchema<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] extends Array<infer U>
    ? Array<Exclude<U, string | mongoose.Types.ObjectId>>
    : Exclude<T[P], string | mongoose.Types.ObjectId>;
} & {
  _id?: any;
};

export const bufferMongooseGetter = (value: unknown) =>
  value != null && (value as any)._bsontype === 'Binary' ? (value as any).buffer : value;
