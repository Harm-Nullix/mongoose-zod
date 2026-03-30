import {z} from 'zod/v4';
import {withMongoose, toMongooseSchema} from '../src/index.js';
import {it, expect, describe} from 'bun:test';

const customGetter = (v: string) => v.toUpperCase();
const customSetter = (v: string) => v.toLowerCase();
const customValidator = (v: string) => v.length > 5;
describe('Field-level withMongoose', () => {
  it('should handle field-level metadata like index and unique', () => {
    const schema = z.object({
      email: withMongoose(z.string().email(), {unique: true, index: true}),
      username: withMongoose(z.string(), {lowercase: true, trim: true, sparse: true}),
    });

    const mSchema = toMongooseSchema(schema);
    const {paths} = mSchema;

    expect(paths.email.options.unique).toBe(true);
    expect(paths.email.options.index).toBe(true);
    expect(paths.username.options.lowercase).toBe(true);
    expect(paths.username.options.trim).toBe(true);
    expect(paths.username.options.sparse).toBe(true);
  });

  it('should handle custom getters, setters and validators via withMongoose', () => {
    const schema = z.object({
      name: withMongoose(z.string(), {
        get: customGetter,
        set: customSetter,
        validate: customValidator,
      }),
    });

    const mSchema = toMongooseSchema(schema);
    const namePath = mSchema.path('name') as any;

    expect(namePath.options.get).toBe(customGetter);
    expect(namePath.options.set).toBe(customSetter);
    expect(namePath.options.validate).toBe(customValidator);
  });

  it('should handle nested withMongoose calls with implicit schema', () => {
    const schema = z.object({
      nested: withMongoose(
        z.object({
          field: withMongoose(z.string(), {index: true}),
        }),
        {_id: false},
      ),
    });

    const mSchema = toMongooseSchema(schema);

    // In this case, Mongoose flattens it to "nested.field"
    expect(mSchema.path('nested.field')).toBeDefined();
    expect(mSchema.path('nested.field').options.index).toBe(true);
  });
});
