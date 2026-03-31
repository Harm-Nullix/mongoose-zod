import {test, expect, describe} from 'bun:test';
import {z} from 'zod/v4';
import {zObjectId, toMongooseSchema} from '../src/index.js';
import mongoose from 'mongoose';

describe('ObjectId Handling', () => {
  test('should allow creating a document without providing _id if zObjectId is present', async () => {
    const UserSchema = z.object({
      _id: zObjectId(),
      name: z.string(),
    });

    const MongooseUserSchema = toMongooseSchema(UserSchema);
    const User = mongoose.model('UserTest_Final', MongooseUserSchema);

    try {
      const user = new User({name: 'Test'});

      // Now that we don't explicitly define _id in the schema,
      // Mongoose handles it automatically and it SHOULD be defined.
      expect(user._id).toBeDefined();
      expect(user._id).toBeInstanceOf(mongoose.Types.ObjectId);
    } finally {
      delete mongoose.models.UserTest_Final;
    }
  });

  test('inspect Mongoose schema definition for _id', () => {
    const UserSchema = z.object({
      _id: zObjectId(),
      name: z.string(),
    });

    const MongooseUserSchema = toMongooseSchema(UserSchema);
    const idPath = MongooseUserSchema.path('_id');

    // In Mongoose, even if not in definition, _id usually exists unless _id: false
    expect(idPath).toBeDefined();
    // It should now be the default Mongoose auto-generated _id
    expect(idPath?.options.auto).toBe(true);
  });

  test('should explicitly include _id if requested', () => {
    const UserSchema = z.object({
      _id: zObjectId({includeId: true}),
      name: z.string(),
    });

    const MongooseUserSchema = toMongooseSchema(UserSchema);
    const idPath = MongooseUserSchema.path('_id');

    expect(idPath).toBeDefined();
    // When we include it explicitly, auto is not set to true by Mongoose's default logic
    // because it was provided in the schema definition object.
    expect(idPath?.options.auto).toBeUndefined();
  });
});
