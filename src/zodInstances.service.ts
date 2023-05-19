import M from 'mongoose';
import {ZodTypeAny, z} from 'zod';

export const zodInstanceofOriginalClasses = new WeakMap<ZodTypeAny, new (...args: any[]) => any>();

export const mongooseZodCustomType = <T extends keyof typeof M.Types & keyof typeof M.Schema.Types>(
  typeName: T,
  params?: Parameters<ZodTypeAny['refine']>[1],
) => {
  const instanceClass = typeName === 'Buffer' ? Buffer : M.Types[typeName];
  const typeClass = M.Schema.Types[typeName];

  type TFixed = T extends 'Buffer' ? BufferConstructor : (typeof M.Types)[T];

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const result = z.instanceof(instanceClass, params) as z.ZodType<
    InstanceType<TFixed>,
    z.ZodTypeDef,
    InstanceType<TFixed>
  >;
  zodInstanceofOriginalClasses.set((result as z.ZodEffects<any>)._def.schema, typeClass);

  return result;
};
