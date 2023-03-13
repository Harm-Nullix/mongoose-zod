import M from 'mongoose';
import { ZodTypeAny, z } from 'zod';

declare const zodInstanceofOriginalClasses: WeakMap<ZodTypeAny, new (...args: any[]) => any>;
declare const mongooseZodCustomType: <T extends "ObjectId" | "Array" | "Buffer" | "Decimal128" | "DocumentArray" | "Map" | "Subdocument">(typeName: T, params?: Parameters<ZodTypeAny['refine']>[1]) => z.ZodType<InstanceType<T extends "Buffer" ? BufferConstructor : (typeof M.Types)[T]>, z.ZodTypeDef, InstanceType<T extends "Buffer" ? BufferConstructor : (typeof M.Types)[T]>>;

export { mongooseZodCustomType, zodInstanceofOriginalClasses };
