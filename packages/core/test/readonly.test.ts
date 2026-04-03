import {z} from 'zod/v4';
import {toMongooseSchema} from '../src/converter.js';
import {describe, it, expect} from 'bun:test';

describe('Zod Readonly support', () => {
  it('should unwrap z.readonly() and map to the underlying Mongoose type', () => {
    const ReadonlySchema = z.object({
      name: z.string().readonly(),
      age: z.number().readonly(),
      tags: z.array(z.string()).readonly(),
    });

    const mongooseSchema = toMongooseSchema(ReadonlySchema);

    expect(mongooseSchema.path('name').instance).toBe('String');
    expect((mongooseSchema.path('name') as any).options.readOnly).toBe(true);

    expect(mongooseSchema.path('age').instance).toBe('Number');
    expect((mongooseSchema.path('age') as any).options.readOnly).toBe(true);

    expect(mongooseSchema.path('tags').instance).toBe('Array');
    expect((mongooseSchema.path('tags') as any).options.readOnly).toBe(true);
  });

  it('should preserve other features like optional and default when using readonly', () => {
    const ComplexSchema = z.object({
      optionalReadonly: z.string().optional().readonly(),
      defaultReadonly: z.string().default('test').readonly(),
    });

    const mongooseSchema = toMongooseSchema(ComplexSchema);

    expect(mongooseSchema.path('optionalReadonly').instance).toBe('String');
    expect((mongooseSchema.path('optionalReadonly') as any).options.required).toBe(false);
    expect((mongooseSchema.path('optionalReadonly') as any).options.readOnly).toBe(true);

    expect(mongooseSchema.path('defaultReadonly').instance).toBe('String');
    expect((mongooseSchema.path('defaultReadonly') as any).options.default).toBe('test');
    expect((mongooseSchema.path('defaultReadonly') as any).options.readOnly).toBe(true);
  });
});
