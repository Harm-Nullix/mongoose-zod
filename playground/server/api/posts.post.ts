import {PostModel, initDB} from '#server/models';
import {PostInputSchema, type Post, type PostInput} from '#shared/schemas';

export default defineEventHandler<Promise<Post>, PostInput>(async (event) => {
  // Ensure DB is connected
  await initDB();

  const body = await readValidatedBody(event, PostInputSchema.parse);

  const post = await PostModel.create({
    ...body,
  });

  return post;
});
