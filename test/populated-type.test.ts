import {expect, test} from 'bun:test';
import {z} from 'zod/v4';
import {zPopulated, type PopulatedSchema} from '../src/index.js';

test('PopulatedSchema should correctly extract types', () => {
  const UserSchema = z.object({
    _id: z.string(),
    name: z.string(),
  });

  const PostSchema = z.object({
    _id: z.string(),
    title: z.string(),
    author: zPopulated('User', UserSchema),
    mentions: z.array(zPopulated('User', UserSchema)),
  });

  type Post = z.infer<typeof PostSchema>;
  type PopulatedPost = PopulatedSchema<Post, 'author' | 'mentions'>;

  // Type check (this is more of a compile-time test, but we can verify properties)
  const post: PopulatedPost = {
    _id: '123',
    title: 'Hello World',
    author: {
      _id: '456',
      name: 'John Doe',
    },
    mentions: [
      {
        _id: '789',
        name: 'Jane Doe',
      },
    ],
  };

  expect(post.author.name).toBe('John Doe');
  expect(post.mentions[0].name).toBe('Jane Doe');
});
