import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import {withMongoose, toMongooseSchema} from '../src/index.js';

describe('Mongoose Schema Options via withMongoose', () => {
  test('should apply top-level schema options like collection and versionKey', () => {
    const UserZodSchema = withMongoose(
      z.object({
        name: z.string(),
      }),
      {
        collection: 'custom_users',
        versionKey: '__v_custom',
        timestamps: true,
      },
    );

    const schema = toMongooseSchema(UserZodSchema);

    expect(schema.get('collection')).toBe('custom_users');
    expect(schema.options.versionKey).toBe('__v_custom');
    expect(schema.options.timestamps).toBe(true);
  });

  test('should allow overriding options in toMongooseSchema', () => {
    const UserZodSchema = withMongoose(
      z.object({
        name: z.string(),
      }),
      {
        collection: 'original_collection',
      },
    );

    const schema = toMongooseSchema(UserZodSchema, {
      collection: 'overridden_collection',
    });

    expect(schema.get('collection')).toBe('overridden_collection');
  });
});
