import {z} from 'zod/v4';
import {zObjectId} from '../src/index.js';

export const shared = z.object({
  _id: zObjectId(),
  name: z.string(),
  n: z.number().min(2),
  createdAt: z.date(),
  updatedAt: z.date(),
  mixed: z.json(),
  deletedAt: z.date().nullable(),
});
