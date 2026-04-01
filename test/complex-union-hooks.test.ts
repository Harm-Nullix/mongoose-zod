import {expect, test, describe} from 'bun:test';
import {z} from 'zod/v4';
import {toMongooseSchema, hooks} from '../src/index.js';
import mongoose from 'mongoose';

describe('Complex Unions and Hooks', () => {
  test('should fallback to Mixed for complex unions by default', () => {
    const schema = z.object({
      union: z.union([
        z.object({ a: z.string() }),
        z.object({ b: z.number() })
      ])
    });

    const mongooseSchema = toMongooseSchema(schema);
    const path = mongooseSchema.path('union') as any;
    expect(path.instance).toBe('Mixed');
  });

  test('should allow enabling complex unions via hooks (though Mongoose support is buggy)', () => {
    const schema = z.object({
      union: z.union([
        z.object({ a: z.string() }),
        z.object({ b: z.number() })
      ])
    });

    // Unregister any previous hooks to be safe
    hooks.removeAllHooks();

    hooks.hook('schema:union:before', (context) => {
      // Force it to be treated as a simple union to trigger the Mongoose Union mapping
      context.ctx.isSimpleUnion = true;
    });

    const mongooseSchema = toMongooseSchema(schema);
    const path = mongooseSchema.path('union') as any;
    
    // It should now be a Union because we forced isSimpleUnion = true
    // Note: extractMongooseDef checks isSimpleUnion again in its own scope, 
    // but the hook modifies the context. Wait, the hook modifies a local variable?
    // Let me check src/extract-mongoose-def.ts again.
    
    expect(path.instance).toBe('Union');
    expect(path.options.of).toHaveLength(2);
    
    hooks.removeAllHooks();
  });
});
