import { describe, it, expect } from 'bun:test';
import { z } from 'zod/v4';
import mongoose from 'mongoose';
import { toMongooseSchema, withMongoose } from '../src/index.js';

describe('Composite ID Support', () => {
  it('should support composite _id as an object', () => {
    const CompositeIdSchema = z.object({
      pk: z.string(),
      sk: z.string()
    });

    const UserSchema = z.object({
      _id: withMongoose(CompositeIdSchema, { includeId: true }),
      name: z.string()
    });

    const mongooseSchema = toMongooseSchema(UserSchema);

    // Check if _id is correctly defined in Mongoose
    const idPath = mongooseSchema.path('_id.pk');
    expect(idPath).toBeDefined();

    const User = mongoose.model('UserComposite', mongooseSchema);
    const user = new User({
      _id: { pk: 'user_1', sk: 'meta' },
      name: 'John Doe'
    });

    expect(user._id.pk).toBe('user_1');
    expect(user._id.sk).toBe('meta');
    expect(user.name).toBe('John Doe');
  });

  it('should support composite _id without withMongoose if we set includeId: true in schema options', () => {
    const CompositeIdSchema = z.object({
      pk: z.string(),
      sk: z.string()
    });

    const UserSchema = z.object({
      _id: CompositeIdSchema,
      name: z.string()
    });

    // Option 2: includeId: true in schema metadata
    const mongooseSchema = toMongooseSchema(withMongoose(UserSchema, { includeId: true }));

    expect(mongooseSchema.path('_id.pk')).toBeDefined();
  });

  it('should support non-ObjectId string _id', () => {
    const UserSchema = z.object({
      _id: withMongoose(z.string(), { includeId: true }),
      name: z.string()
    });

    const mongooseSchema = toMongooseSchema(UserSchema);
    expect(mongooseSchema.path('_id').instance).toBe('String');
  });
});
