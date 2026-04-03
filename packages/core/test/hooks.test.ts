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

describe('New Hooks v0.2.0', () => {
  it('should call converter:start on every call', () => {
    const schema = z.object({ name: z.string() });
    const startHook = vi.fn();
    hooks.hook('converter:start', startHook);
    extractMongooseDef(schema);
    // 1 for object, 1 for string
    expect(startHook).toHaveBeenCalledTimes(2);
    hooks.removeHook('converter:start', startHook);
  });

  it('should call registry:get and registry:added', () => {
    const schema = z.string();
    const getHook = vi.fn();
    const addedHook = vi.fn();
    hooks.hook('registry:get', getHook);
    hooks.hook('registry:added', addedHook);

    withMongoose(schema, { unique: true });

    expect(getHook).toHaveBeenCalled();
    expect(addedHook).toHaveBeenCalledWith(expect.objectContaining({
      meta: expect.objectContaining({ unique: true })
    }));

    hooks.removeHook('registry:get', getHook);
    hooks.removeHook('registry:added', addedHook);
  });

  it('should call schema object before and after hooks', () => {
    const schema = z.object({ name: z.string() });
    const beforeHook = vi.fn();
    const afterHook = vi.fn();
    hooks.hook('schema:object:before', beforeHook);
    hooks.hook('schema:object:after', afterHook);

    extractMongooseDef(schema);

    expect(beforeHook).toHaveBeenCalled();
    expect(afterHook).toHaveBeenCalled();

    hooks.removeHook('schema:object:before', beforeHook);
    hooks.removeHook('schema:object:after', afterHook);
  });

  it('should call schema array before and after hooks', () => {
    const schema = z.array(z.string());
    const beforeHook = vi.fn();
    const afterHook = vi.fn();
    hooks.hook('schema:array:before', beforeHook);
    hooks.hook('schema:array:after', afterHook);

    extractMongooseDef(schema);

    expect(beforeHook).toHaveBeenCalled();
    expect(afterHook).toHaveBeenCalled();

    hooks.removeHook('schema:array:before', beforeHook);
    hooks.removeHook('schema:array:after', afterHook);
  });

  it('should call schema record before and after hooks', () => {
    const schema = z.record(z.string(), z.string());
    const beforeHook = vi.fn();
    const afterHook = vi.fn();
    hooks.hook('schema:record:before', beforeHook);
    hooks.hook('schema:record:after', afterHook);

    extractMongooseDef(schema);

    expect(beforeHook).toHaveBeenCalled();
    expect(afterHook).toHaveBeenCalled();

    hooks.removeHook('schema:record:before', beforeHook);
    hooks.removeHook('schema:record:after', afterHook);
  });
});
