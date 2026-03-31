import { createHooks, type HookCallback } from 'hookable';
import type { z } from 'zod/v4';
import type { MongooseMeta } from './registry.js';

export interface MongooseZodHooks {
  /**
   * Called before starting the conversion of a Zod schema to a Mongoose definition.
   */
  'converter:before': (context: { schema: z.ZodTypeAny; visited: Map<z.ZodTypeAny, any> }) => void;

  /**
   * Called at the start of each `extractMongooseDef` call, before any processing.
   */
  'converter:start': (context: { schema: z.ZodTypeAny; visited: Map<z.ZodTypeAny, any> }) => void;

  /**
   * Called after unwrapping the Zod schema and extracting metadata, but before processing its type.
   */
  'converter:unwrapped': (context: {
    schema: z.ZodTypeAny;
    unwrapped: z.ZodTypeAny;
    features: any;
    meta: MongooseMeta;
    mongooseProp: any;
  }) => void;

  /**
   * Called for each node being processed in the AST walk.
   */
  'converter:node': (context: {
    schema: z.ZodTypeAny;
    mongooseProp: any;
    type: string;
  }) => void;

  /**
   * Called when a ZodObject is about to be processed.
   */
  'schema:object:before': (context: { schema: z.ZodObject<any>; mongooseProp: any; visited: Map<z.ZodTypeAny, any> }) => void;

  /**
   * Called after a ZodObject has been processed.
   */
  'schema:object:after': (context: { schema: z.ZodObject<any>; mongooseProp: any; objDef: any; result: any }) => void;

  /**
   * Called during ZodObject conversion for each field.
   */
  'schema:object:field': (context: { key: string; schema: z.ZodTypeAny; objDef: any; visited: Map<z.ZodTypeAny, any> }) => void;

  /**
   * Called when a ZodArray/Set/Tuple is about to be processed.
   */
  'schema:array:before': (context: { schema: z.ZodArray<any> | z.ZodSet<any> | z.ZodTuple<any>; mongooseProp: any; visited: Map<z.ZodTypeAny, any> }) => void;

  /**
   * Called after a ZodArray/Set/Tuple has been processed.
   */
  'schema:array:after': (context: { schema: z.ZodArray<any> | z.ZodSet<any> | z.ZodTuple<any>; mongooseProp: any; innerDef: any }) => void;

  /**
   * Called when a ZodRecord/Map is about to be processed.
   */
  'schema:record:before': (context: { schema: z.ZodRecord<any, any> | z.ZodMap<any, any>; mongooseProp: any; visited: Map<z.ZodTypeAny, any> }) => void;

  /**
   * Called after a ZodRecord/Map has been processed.
   */
  'schema:record:after': (context: { schema: z.ZodRecord<any, any> | z.ZodMap<any, any>; mongooseProp: any; innerDef: any }) => void;

  /**
   * Called after the conversion of a Zod schema is complete.
   */
  'converter:after': (context: {
    schema: z.ZodTypeAny;
    mongooseProp: any;
  }) => void;

  /**
   * Called when adding metadata to the registry.
   */
  'registry:add': (context: { schema: z.ZodTypeAny; meta: MongooseMeta }) => void;

  /**
   * Called after adding metadata to the registry.
   */
  'registry:added': (context: { schema: z.ZodTypeAny; meta: MongooseMeta }) => void;

  /**
   * Called before getting metadata from the registry.
   */
  'registry:get:before': (context: { schema: z.ZodTypeAny }) => void;

  /**
   * Called when getting metadata from the registry.
   */
  'registry:get': (context: { schema: z.ZodTypeAny; meta: MongooseMeta | undefined }) => void;

  /**
   * Called after mapping Zod checks to Mongoose options.
   */
  'validation:mappers': (context: { checks: any[]; mongooseProp: any }) => void;

  /**
   * Called after a Mongoose Schema instance has been created in `toMongooseSchema`.
   */
  'schema:created': (context: { schema: z.ZodTypeAny; mongooseSchema: any; options?: any }) => void;
}

export const hooks = createHooks<MongooseZodHooks>();

/**
 * Synchronous hook caller for Hookable.
 */
export function callHookSync<Name extends keyof MongooseZodHooks>(
  name: Name,
  ...args: Parameters<MongooseZodHooks[Name]>
): void {
  hooks.callHookWith((callbacks: HookCallback[], args: any[]) => {
    for (const callback of callbacks) {
      callback(...args);
    }
  }, name, args as any);
}
