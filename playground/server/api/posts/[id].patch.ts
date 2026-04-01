import {PostModel, initDB} from '#server/models';
import {PostInputSchema, type Post, type PostInput} from '#shared/schemas';

export default defineEventHandler<Promise<Post | null>, PostInput>(async (event) => {
  await initDB();
  const id = getRouterParam(event, 'id');
  const body = await readValidatedBody(event, PostInputSchema.partial().parse);

  return PostModel.findByIdAndUpdate(id, body, {new: true}).lean<Post>();
});
