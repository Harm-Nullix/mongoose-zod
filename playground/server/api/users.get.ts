import {UserModel, initDB} from '#server/models';
import {type User} from '#shared/schemas';

export default defineEventHandler<Promise<User[]>>(async (event) => {
  // Ensure DB is connected
  await initDB();

  return UserModel.find().sort({username: 1}).lean<User[]>();
});
