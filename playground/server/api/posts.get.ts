import {PostModel, initDB} from '#server/models';
import {type PopulatedPost} from '#shared/schemas';

export default defineEventHandler<Promise<PopulatedPost[]>>(async (event) => {
  // Ensure DB is connected
  await initDB();

  return PostModel.find().populate('author mentions').sort({createdAt: -1}).lean<PopulatedPost[]>();
});
