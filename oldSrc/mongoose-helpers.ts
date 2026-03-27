import M from 'mongoose';
import {z} from 'zod/v4';
import {MongooseZodError} from './errors.js';
import {MongooseSchemaOptionsSymbol, ZodMongoose} from './extensions.js';

export interface MZLeanOptions {
  virtuals?: boolean;
  defaults?: boolean;
  getters?: boolean;
}

const tryImportModule = (moduleName: string) => {
  try {
    const mod = require(moduleName);
    return mod.default || mod;
  } catch (e) {
    return null;
  }
};

export const getLeanVirtualsImplementation = () => tryImportModule('mongoose-lean-virtuals');
export const getLeanDefaultsImplementation = () => tryImportModule('mongoose-lean-defaults');
export const getLeanGettersImplementation = () => tryImportModule('mongoose-lean-getters');

type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never;

const DateFieldZod = () => z.date().default(new Date());

export const genTimestampsSchema = <CrAt = 'createdAt', UpAt = 'updatedAt'>(
  createdAtField: StringLiteral<CrAt | 'createdAt'> | null = 'createdAt',
  updatedAtField: StringLiteral<UpAt | 'updatedAt'> | null = 'updatedAt',
) => {
  if (createdAtField != null && updatedAtField != null && createdAtField === updatedAtField) {
    throw new MongooseZodError('`createdAt` and `updatedAt` fields must be different');
  }

  const schema = z.object({
    ...(createdAtField != null && {
      [createdAtField]: DateFieldZod().mongooseTypeOptions({immutable: true, index: true}),
    }),
    ...(updatedAtField != null && {
      [updatedAtField]: DateFieldZod().mongooseTypeOptions({index: true}),
    }),
  } as {
    [_ in StringLiteral<NonNullable<CrAt | UpAt>>]: z.ZodDefault<z.ZodDate>;
  });
  const def = (schema as any).def || (schema as any)._def || (schema as any)._zod?.def;
  def[MongooseSchemaOptionsSymbol] = {
    ...def[MongooseSchemaOptionsSymbol],
    timestamps: {
      createdAt: createdAtField == null ? false : createdAtField,
      updatedAt: updatedAtField == null ? false : updatedAtField,
    },
  };
  return schema;
};

export type MongooseSchemaTypeParameters<
  T,
  Parameter extends 'InstanceMethods' | 'QueryHelpers' | 'TStaticMethods' | 'TVirtuals',
> =
  T extends ZodMongoose<
    any,
    any,
    infer InstanceMethods,
    infer QueryHelpers,
    infer TStaticMethods,
    infer TVirtuals
  >
    ? {
        InstanceMethods: InstanceMethods;
        QueryHelpers: QueryHelpers;
        TStaticMethods: TStaticMethods;
        TVirtuals: TVirtuals;
      }[Parameter]
    : {};

// const noCastFn = (value: any) => value;

export class MongooseZodBoolean extends M.Schema.Types.Boolean {
  static schemaName = 'MongooseZodBoolean' as 'Boolean';
  // cast = noCastFn;
}

export class MongooseZodDate extends M.Schema.Types.Date {
  static schemaName = 'MongooseZodDate' as 'Date';
  // cast = noCastFn;
}

export class MongooseZodNumber extends M.Schema.Types.Number {
  static schemaName = 'MongooseZodNumber' as 'Number';
  // cast = noCastFn;
}
export class MongooseZodBigInt extends M.Schema.Types.BigInt {
  static schemaName = 'MongooseZodBigInt' as 'BigInt';
  // cast = noCastFn;
}

export class MongooseZodString extends M.Schema.Types.String {
  static schemaName = 'MongooseZodString' as 'String';
  // cast = noCastFn;
}

export const registerCustomMongooseZodTypes = (): void => {
  const types = {
    MongooseZodBoolean,
    MongooseZodDate,
    MongooseZodNumber,
    MongooseZodBigInt,
    MongooseZodString,
  };
  Object.assign(M.Schema.Types, types);
  Object.assign(M.SchemaTypes, types);
};

export const bufferMongooseGetter = (value: unknown) =>
  value instanceof M.mongo.Binary ? value.buffer : value;
