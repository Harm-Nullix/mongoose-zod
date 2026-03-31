import {z} from 'zod/v4';
import type mongoose from 'mongoose';
import type {SchemaDefinition, SchemaOptions} from 'mongoose';
import {mongooseRegistry} from './registry.js';
import {unwrapZodSchema} from './zod-helpers.js';
import {getMongoose} from './config.js';
import {extractMongooseDef} from './extract-mongoose-def.js';

export {extractMongooseDef} from './extract-mongoose-def.js';
export type {ToMongooseType} from './extract-mongoose-def.js';

/**
 * Converts a Zod schema to a Mongoose Schema instance.
 */
export function toMongooseSchema<T extends z.ZodTypeAny>(
  schema: T,
  options?: SchemaOptions,
): mongoose.Schema<z.infer<T>> {
  const {schema: unwrapped} = unwrapZodSchema(schema);
  const meta =
    mongooseRegistry.get(schema) ||
    mongooseRegistry.get(unwrapped) ||
    (schema as any).meta?.() ||
    (unwrapped as any).meta?.() ||
    {};

  const mergedOptions: SchemaOptions = {
    // Also merge other schema options from meta if they exist
    ...(meta.collection ? {collection: meta.collection} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.strict !== undefined ? {strict: meta.strict} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.minimize !== undefined ? {minimize: meta.minimize} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.validateBeforeSave !== undefined ? {validateBeforeSave: meta.validateBeforeSave} : {}),
    // eslint-disable-next-line unicorn/no-negated-condition
    ...(meta.versionKey !== undefined ? {versionKey: meta.versionKey} : {}),
    ...(meta.id === undefined ? {} : {id: meta.id}),
    ...(meta._id === undefined ? {} : {_id: meta._id}),
    ...(meta.timestamps ? {timestamps: meta.timestamps} : {}),
    ...(meta.discriminatorKey ? {discriminatorKey: meta.discriminatorKey} : {}),
    ...options,
  };

  const definition = extractMongooseDef(schema) as unknown as SchemaDefinition;
  const mongoose = getMongoose();

  if (!mongoose) {
    throw new Error(
      'Mongoose must be installed to use toMongooseSchema. If you are in an ESM environment, ensure mongoose is loaded.',
    );
  }

  return new mongoose.Schema(definition, mergedOptions) as any;
}
