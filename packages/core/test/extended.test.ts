import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import {toMongooseSchema} from '../src/converter.js';
import {genTimestampsSchema, zObjectId, zBuffer} from '../src/mongoose-helpers.js';
import {withMongoose} from '../src/registry.js';

describe('Extended Conversion', () => {
  test('should convert Buffer correctly', () => {
    const schema = z.object({
      data: zBuffer(),
    });
    const mongooseSchema = toMongooseSchema(schema);
    const dataProp = mongooseSchema.path('data');

    expect(dataProp.instance).toBe('Buffer');
  });

  test('should convert ObjectId correctly', () => {
    const schema = z.object({
      refId: zObjectId(),
    });
    const mongooseSchema = toMongooseSchema(schema);
    const refIdProp = mongooseSchema.path('refId');

    expect(refIdProp.instance).toBe('ObjectId');
  });

  test('should support options for zObjectId and zBuffer', () => {
    const schema = z.object({
      refId: zObjectId({index: true, unique: true}),
      data: zBuffer({required: true}),
    });
    const mongooseSchema = toMongooseSchema(schema);

    const refIdProp = mongooseSchema.path('refId') as any;
    expect(refIdProp.instance).toBe('ObjectId');
    expect(refIdProp.options.index).toBe(true);
    expect(refIdProp.options.unique).toBe(true);

    const dataProp = mongooseSchema.path('data') as any;
    expect(dataProp.instance).toBe('Buffer');
    expect(dataProp.isRequired).toBe(true);
  });

  test('should support timestamps via genTimestampsSchema', () => {
    const timestampShape = genTimestampsSchema();
    const schema = z.object(timestampShape).extend({
      name: z.string(),
    });

    const mongooseSchema = toMongooseSchema(withMongoose(schema, {timestamps: true}));

    expect(mongooseSchema.path('createdAt')).toBeDefined();
    expect(mongooseSchema.path('updatedAt')).toBeDefined();
    expect((mongooseSchema as any).options.timestamps).toBe(true);
  });

  test('should support custom timestamps via genTimestampsSchema', () => {
    const timestampShape = genTimestampsSchema('created_at', 'updated_at');
    const schema = z.object(timestampShape).extend({
      name: z.string(),
    });

    const mongooseSchema = toMongooseSchema(
      withMongoose(schema, {timestamps: {createdAt: 'created_at', updatedAt: 'updated_at'}}),
    );

    expect(mongooseSchema.path('created_at')).toBeDefined();
    expect(mongooseSchema.path('updated_at')).toBeDefined();
    expect((mongooseSchema as any).options.timestamps).toEqual({
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    });
  });

  test('should disable timestamps when null passed to genTimestampsSchema', () => {
    const timestampShape = genTimestampsSchema('createdAt', null);
    const schema = z.object(timestampShape).extend({
      name: z.string(),
    });

    const mongooseSchema = toMongooseSchema(
      withMongoose(schema, {timestamps: {createdAt: 'createdAt', updatedAt: false}}),
    );

    expect(mongooseSchema.path('createdAt')).toBeDefined();
    expect(mongooseSchema.path('updatedAt')).toBeUndefined();
    expect((mongooseSchema as any).options.timestamps).toEqual({
      createdAt: 'createdAt',
      updatedAt: false,
    });
  });
});
