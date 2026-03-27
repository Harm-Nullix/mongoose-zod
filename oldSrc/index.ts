import {z} from 'zod/v4';
import {addMongooseToZodPrototype, addMongooseTypeOptionsToZodPrototype} from './extensions.js';

addMongooseToZodPrototype(z);
addMongooseTypeOptionsToZodPrototype(z);

export {MongooseZodError} from './errors.js';
export {
  bufferMongooseGetter,
  genTimestampsSchema,
  registerCustomMongooseZodTypes,
  MongooseZodBoolean,
  MongooseZodDate,
  MongooseZodNumber,
  MongooseZodBigInt,
  MongooseZodString,
} from './mongoose-helpers.js';
export {toMongooseSchema} from './to-mongoose.js';
export type {
  DisableablePlugins,
  SetupOptions,
  ToMongooseSchemaOptions,
  UnknownKeysHandling,
} from './mz-types.js';
export {mongooseZodCustomType} from './zodInstances.service.js';
export {
  MongooseSchemaOptionsSymbol,
  MongooseTypeOptionsSymbol,
  ZodMongoose,
  toZodMongooseSchema,
  addMongooseTypeOptions,
  z,
} from './extensions.js';
export {setup} from './setup.js';
