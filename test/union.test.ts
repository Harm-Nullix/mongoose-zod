import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import {toMongooseSchema} from '../src/index.js';
import mongoose from 'mongoose';

describe('Zod Union to Mongoose Union', () => {
  test('should map simple union to Schema.Types.Union', () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    });

    const mongooseSchema = toMongooseSchema(schema);
    const valuePath = mongooseSchema.path('value') as any;

    // In Mongoose 8.2+, it should be 'Union' for simple primitive unions
    expect(valuePath.instance).toBe('Union');
    expect(valuePath.options.of).toBeArray();
    expect(valuePath.options.of).toHaveLength(2);
    expect(valuePath.options.of[0]).toBe(String);
    expect(valuePath.options.of[1]).toBe(Number);
  });

  test('should map complex union to its constituent fields', () => {
    const schema = z.object({
      activity: z.discriminatedUnion('type', [
        z.object({ type: z.literal('run'), distance: z.number() }),
        z.object({ type: z.literal('swim'), laps: z.number() }),
      ]),
    });

    const mongooseSchema = toMongooseSchema(schema);
    const typePath = mongooseSchema.path('activity.type') as any;
    const distancePath = mongooseSchema.path('activity.distance') as any;
    const lapsPath = mongooseSchema.path('activity.laps') as any;

    expect(typePath.instance).toBe('Mixed');
    expect(distancePath.instance).toBe('Number');
    expect(lapsPath.instance).toBe('Number');
    
    // Ensure all union members are optional in the final schema
    expect(typePath.options.required).toBe(false);
    expect(distancePath.options.required).toBe(false);
    expect(lapsPath.options.required).toBe(false);
  });

  test('should correctly validate data against Mongoose Union', async () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    });
    const mongooseSchema = toMongooseSchema(schema);
    const Model = mongoose.model('UnionTest', mongooseSchema);

    // Valid data
    const doc1 = new Model({ value: 'hello' });
    await doc1.validate();

    const doc2 = new Model({ value: 42 });
    await doc2.validate();

    // Invalid data
    const doc3 = new Model({ value: { a: 1 } });
    let error;
    try {
      await doc3.validate();
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
    // In Mongoose it seems to be CastError
    expect(error.errors.value.name).toBe('CastError');
  });
});
