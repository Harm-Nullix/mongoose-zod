import { describe, it, expect } from 'bun:test';
import { z } from 'zod/v4';
import { mapZodChecksToMongoose } from '../src/validation-mappers.js';

describe('validation-mappers', () => {
  it('should map min/max length for strings', () => {
    const schema = z.string().min(5).max(10);
    // In Zod v4, checks are in _def.checks
    const {checks} = (schema as any)._def;
    const mongooseProp: any = {};

    mapZodChecksToMongoose(checks, mongooseProp);

    expect(mongooseProp.minlength).toBe(5);
    expect(mongooseProp.maxlength).toBe(10);
  });

  it('should map exact length for strings', () => {
    const schema = z.string().length(7);
    const {checks} = (schema as any)._def;
    const mongooseProp: any = {};

    mapZodChecksToMongoose(checks, mongooseProp);

    expect(mongooseProp.minlength).toBe(7);
    expect(mongooseProp.maxlength).toBe(7);
  });

  it('should map gt/lt for numbers', () => {
    const schema = z.number().gt(5).lt(10);
    const {checks} = (schema as any)._def;
    const mongooseProp: any = {};

    mapZodChecksToMongoose(checks, mongooseProp);

    expect(mongooseProp.min).toBe(5);
    expect(mongooseProp.max).toBe(10);
  });

  it('should map regex', () => {
    const pattern = /abc/;
    const schema = z.string().regex(pattern);
    const {checks} = (schema as any)._def;
    const mongooseProp: any = {};

    mapZodChecksToMongoose(checks, mongooseProp);

    expect(mongooseProp.match).toBe(pattern);
  });

  it('should map string transforms (trim, lowercase, uppercase)', () => {
    const schema = z.string().trim().toLowerCase().toUpperCase();
    // In Zod v4, these might be implemented as transformations/pipes,
    // but the mapper looks for $ZodCheckOverwrite and checkDef.tx
    const {checks} = (schema as any)._def;
    const mongooseProp: any = {};

    mapZodChecksToMongoose(checks, mongooseProp);

    expect(mongooseProp.trim).toBe(true);
    expect(mongooseProp.lowercase).toBe(true);
    expect(mongooseProp.uppercase).toBe(true);
  });
});
