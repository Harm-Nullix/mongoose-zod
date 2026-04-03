import { expect, test, describe, mock } from 'bun:test';
import { z } from 'zod/v4';
import { toMongooseSchema } from '../src/converter.js';
import { hooks } from '../src/hooks.js';
import mongoose from 'mongoose';

describe('Plugins and Schema Hooks', () => {
  test('should support Mongoose plugins via options', () => {
    const schema = z.object({
      name: z.string(),
    });

    const plugin = mock((s: mongoose.Schema) => {
      s.virtual('pluginVirtual').get(() => 'hello');
    });

    const mongooseSchema = toMongooseSchema(schema, {
      plugins: [plugin],
    });

    expect(plugin).toHaveBeenCalled();
    expect((mongooseSchema.virtuals as any).pluginVirtual).toBeDefined();
  });

  test('should support schema:created hook', () => {
    const schema = z.object({
      name: z.string(),
    });

    const hookCallback = mock(({ mongooseSchema }: { mongooseSchema: mongoose.Schema }) => {
      mongooseSchema.virtual('hookVirtual').get(() => 'world');
    });

    const unhook = hooks.hook('schema:created', hookCallback);

    const mongooseSchema = toMongooseSchema(schema);

    expect(hookCallback).toHaveBeenCalled();
    expect((mongooseSchema.virtuals as any).hookVirtual).toBeDefined();

    unhook();
  });

  test('should support both plugins and hooks together', () => {
    const schema = z.object({
      name: z.string(),
    });

    const plugin = mock((s: mongoose.Schema) => {
      s.virtual('p1').get(() => 1);
    });

    const hookCallback = mock(({ mongooseSchema }: { mongooseSchema: mongoose.Schema }) => {
      mongooseSchema.virtual('h1').get(() => 2);
    });

    const unhook = hooks.hook('schema:created', hookCallback);

    const mongooseSchema = toMongooseSchema(schema, {
      plugins: [plugin],
    });

    expect(plugin).toHaveBeenCalled();
    expect(hookCallback).toHaveBeenCalled();
    expect((mongooseSchema.virtuals as any).p1).toBeDefined();
    expect((mongooseSchema.virtuals as any).h1).toBeDefined();

    unhook();
  });
});
