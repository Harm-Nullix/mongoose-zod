import { describe, it, expect, vi } from 'bun:test';
import { z } from 'zod/v4';
import { extractMongooseDef, hooks, withMongoose } from '../src/index.js';

const modifierHook = (context: any) => {
  if (context.type === 'string') {
    context.mongooseProp.uppercase = true;
  }
};

describe('Hooks', () => {
  it('should call converter hooks during conversion', () => {
    const schema = z.object({
      name: z.string(),
    });

    const beforeHook = vi.fn();
    const unwrappedHook = vi.fn();
    const nodeHook = vi.fn();
    const afterHook = vi.fn();

    hooks.hook('converter:before', beforeHook);
    hooks.hook('converter:unwrapped', unwrappedHook);
    hooks.hook('converter:node', nodeHook);
    hooks.hook('converter:after', afterHook);

    extractMongooseDef(schema);

    expect(beforeHook).toHaveBeenCalled();
    expect(unwrappedHook).toHaveBeenCalled();
    expect(nodeHook).toHaveBeenCalled();
    expect(afterHook).toHaveBeenCalled();

    // Cleanup
    hooks.removeHook('converter:before', beforeHook);
    hooks.removeHook('converter:unwrapped', unwrappedHook);
    hooks.removeHook('converter:node', nodeHook);
    hooks.removeHook('converter:after', afterHook);
  });

  it('should allow modifying the conversion result via hooks', () => {
    const schema = z.object({
      name: z.string(),
    });

    hooks.hook('converter:node', modifierHook);

    const def: any = extractMongooseDef(schema);

    expect(def.name.uppercase).toBe(true);

    // Cleanup
    hooks.removeHook('converter:node', modifierHook);
  });

  it('should call registry hooks', () => {
    const schema = z.string();
    const addHook = vi.fn();

    hooks.hook('registry:add', addHook);

    withMongoose(schema, { index: true });

    expect(addHook).toHaveBeenCalledWith(expect.objectContaining({
      schema,
      meta: expect.objectContaining({ index: true })
    }));

    // Cleanup
    hooks.removeHook('registry:add', addHook);
  });

  it('should call schema hooks', () => {
    const schema = z.object({
      name: z.string(),
    });

    const fieldHook = vi.fn();
    hooks.hook('schema:object:field', fieldHook);

    extractMongooseDef(schema);

    expect(fieldHook).toHaveBeenCalledWith(expect.objectContaining({
      key: 'name',
    }));

    hooks.removeHook('schema:object:field', fieldHook);
  });
});
