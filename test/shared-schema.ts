import {z} from 'zod/v4';
import {withMongoose, zObjectId} from '../src/index.js';

export const shared = z.object({
  _id: zObjectId(),
  name: z.string(),
  n: z.number().min(2),
  createdAt: z.date(),
  updatedAt: z.date(),
  mixed: withMongoose(z.json().optional(), {required: true}),
  deletedAt: z.date().nullable(),
});
