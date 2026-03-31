import {z} from 'zod/v4';
import {zObjectId, zPopulated, type PopulatedSchema} from 'mongoose-zod';

export const UserZodSchema = z
  .object({
    _id: zObjectId(),
    username: z.string().min(3).max(30),
    email: z.email(),
    fullName: z.string().optional(),
  })
  .describe('User');

export type User = z.infer<typeof UserZodSchema>;

export const PostZodSchema = z
  .object({
    _id: zObjectId(),
    title: z.string().min(5).max(100),
    content: z.string().min(10),
    author: zPopulated('User', UserZodSchema),
    mentions: z.array(zPopulated('User', UserZodSchema)).default([]),
    published: z.boolean().default(false),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  })
  .describe('Post');

export type Post = z.infer<typeof PostZodSchema>;

/**
 * Input schema for creating a new Post.
 * We omit timestamp fields that are handled by the server.
 * _id is already optional in PostZodSchema because of zObjectId() update.
 * We also ensure that author and mentions can be strings (ObjectIds) since that's what's typically sent from a form.
 */
export const PostInputSchema = PostZodSchema.omit({
  _id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  author: zObjectId().optional(),
  mentions: z.array(zObjectId()).default([]),
});

export type PostInput = z.infer<typeof PostInputSchema>;

// Use the Populated helper to define PopulatedPost
export type PopulatedPost = PopulatedSchema<Post, 'author' | 'mentions'>;
