import {PostModel, initDB} from '#server/models';

export default defineEventHandler(async (event) => {
  await initDB();
  const id = getRouterParam(event, 'id');
  await PostModel.findByIdAndDelete(id);
  return {success: true};
});
