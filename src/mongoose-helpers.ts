import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {withMongoose, MongooseMeta} from './registry.js';

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

export const zObjectId = (options?: MongooseMeta) =>
  withMongoose(z.custom<mongoose.Types.ObjectId>(), {
    type: mongoose.Schema.Types.ObjectId,
    ...options,
  });

export const zBuffer = (options?: MongooseMeta) =>
  withMongoose(z.custom<Buffer>(), {
    type: mongoose.Schema.Types.Buffer,
    ...options,
  });

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
