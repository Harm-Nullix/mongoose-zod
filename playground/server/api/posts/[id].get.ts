import {PostModel, initDB} from '#server/models';
import {type PopulatedPost} from '#shared/schemas';

export default defineEventHandler<Promise<PopulatedPost | null>>(async (event) => {
  await initDB();
  const id = getRouterParam(event, 'id');
  return PostModel.findById(id).populate('author mentions').lean<PopulatedPost>();
});
