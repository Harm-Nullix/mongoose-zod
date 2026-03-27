import M from 'mongoose';
import {z} from 'zod/v4';

export const zodInstanceofOriginalClasses = new WeakMap<
  z.ZodTypeAny,
  new (...args: any[]) => any
>();

export const mongooseZodCustomType = <T extends keyof typeof M.Types & keyof typeof M.Schema.Types>(
  typeName: T,
  params?: Parameters<z.ZodTypeAny['refine']>[1],
) => {
  const instanceClass = typeName === 'Buffer' ? Buffer : M.Types[typeName];
  const typeClass = M.Schema.Types[typeName];

  const result = z.instanceof(instanceClass, params) as any;
  const def = (result as any).def || (result as any)._def;
  const innerSchema = def.schema || def.innerType || result;
  zodInstanceofOriginalClasses.set(innerSchema, typeClass);
  def.mongooseZodCustomType = typeClass;

  return result as any;
};
