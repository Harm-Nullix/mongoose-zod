import {test, expect, describe} from 'bun:test';
import {z} from 'zod/v4';
import {zObjectId, zBuffer, setFrontendMode, toMongooseSchema} from '../src/index.js';
import mongoose from 'mongoose';

describe('Isomorphic Support', () => {
  test('should handle ObjectId as string in frontend mode', () => {
    setFrontendMode(true);
    const schema = z.object({
      _id: zObjectId(),
    });

    const validData = {_id: '507f1f77bcf86cd799439011'};
    const invalidData = {_id: 'not-an-object-id'};

    expect(schema.parse(validData)).toEqual(validData);
    const result = schema.safeParse(invalidData);
    expect(result.success).toBe(false);

    setFrontendMode(false); // Reset for other tests
  });

  test('should handle Buffer as Uint8Array in frontend mode', () => {
    setFrontendMode(true);
    const schema = z.object({
      data: zBuffer(),
    });

    const validData = {data: new Uint8Array([1, 2, 3])};
    // In frontend mode it uses z.instanceof(Uint8Array)

    expect(schema.parse(validData)).toEqual(validData);

    setFrontendMode(false);
  });

  test('should still convert to proper Mongoose types even if defined in frontend mode', () => {
    setFrontendMode(true);
    const schema = z.object({
      _id: zObjectId(),
      buf: zBuffer(),
    });
    setFrontendMode(false);

    // The metadata should still point to ObjectId/Buffer types
    // though they might be stored as strings in the metadata if we used the string fallback
    const mongooseSchema = toMongooseSchema(schema);

    expect(mongooseSchema.path('_id').instance).toBe('ObjectId');
    expect(mongooseSchema.path('buf').instance).toBe('Buffer');
  });

  test('shared-schema.ts should work in both modes', async () => {
    // Import the shared schema
    const {shared} = await import('./shared-schema.js');

    // Test Backend Mode (default)
    setFrontendMode(false);
    const oid = new mongoose.Types.ObjectId();
    expect(
      shared.parse({
        _id: oid,
        name: 'test',
        n: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        mixed: {foo: 'bar'},
        deletedAt: null,
      })._id,
    ).toBeInstanceOf(mongoose.Types.ObjectId);

    // Test Frontend Mode
    setFrontendMode(true);
    const oidStr = '507f1f77bcf86cd799439011';
    const parsed = shared.parse({
      _id: oidStr,
      name: 'test',
      n: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
      mixed: {foo: 'bar'},
      deletedAt: null,
    });
    expect(typeof parsed._id).toBe('string');
    expect(parsed._id).toBe(oidStr);

    setFrontendMode(false);
  });
});
