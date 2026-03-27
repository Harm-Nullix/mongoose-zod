import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import mongoose from 'mongoose';
import {toMongooseSchema} from '../src/converter.js';
import {withMongoose} from '../src/registry.js';
import {genTimestampsSchema} from '../src/mongoose-helpers.js';

describe('Extended Conversion', () => {
  test('should convert Buffer correctly', () => {
    const schema = z.object({
      data: withMongoose(z.instanceof(Buffer), {type: mongoose.Schema.Types.Buffer}),
    });
    const mongooseSchema = toMongooseSchema(schema);
    const dataProp = mongooseSchema.path('data');

    expect(dataProp.instance).toBe('Buffer');
  });

  test('should convert ObjectId correctly', () => {
    const schema = z.object({
      refId: withMongoose(z.instanceof(mongoose.Types.ObjectId), {
        type: mongoose.Schema.Types.ObjectId,
      }),
    });
    const mongooseSchema = toMongooseSchema(schema);
    const refIdProp = mongooseSchema.path('refId');

    expect(refIdProp.instance).toBe('ObjectId');
  });

  test('should support timestamps via genTimestampsSchema', () => {
    const timestampSchema = genTimestampsSchema();
    const schema = timestampSchema.extend({
      name: z.string(),
    });

    const meta = (timestampSchema as any).meta?.();
    const mongooseSchema = toMongooseSchema(withMongoose(schema, meta));

    expect(mongooseSchema.path('createdAt')).toBeDefined();
    expect(mongooseSchema.path('updatedAt')).toBeDefined();
    expect((mongooseSchema as any).options.timestamps).toEqual({
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    });
  });

  test('should support custom timestamps via genTimestampsSchema', () => {
    const timestampSchema = genTimestampsSchema('created_at', 'updated_at');
    const schema = timestampSchema.extend({
      name: z.string(),
    });

    const meta = (timestampSchema as any).meta?.();
    const mongooseSchema = toMongooseSchema(withMongoose(schema, meta));

    expect(mongooseSchema.path('created_at')).toBeDefined();
    expect(mongooseSchema.path('updated_at')).toBeDefined();
    expect((mongooseSchema as any).options.timestamps).toEqual({
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    });
  });

  test('should disable timestamps when null passed to genTimestampsSchema', () => {
    const timestampSchema = genTimestampsSchema('createdAt', null);
    const schema = timestampSchema.extend({
      name: z.string(),
    });

    const meta = (timestampSchema as any).meta?.();
    const mongooseSchema = toMongooseSchema(withMongoose(schema, meta));

    expect(mongooseSchema.path('createdAt')).toBeDefined();
    expect(mongooseSchema.path('updatedAt')).toBeUndefined();
    expect((mongooseSchema as any).options.timestamps).toEqual({
      createdAt: 'createdAt',
      updatedAt: false,
    });
  });
});
