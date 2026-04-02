import {
  TaskModel,
  SettingsModel,
  ActivityModel,
  AssetModel,
  UserModel,
} from '../../models/index.js';

export default defineEventHandler(async (event) => {
  const {method} = event;
  const path = getRequestPath(event);

  if (path.endsWith('/users')) {
    return await UserModel.find().limit(10).lean();
  }

  if (path.endsWith('/tasks')) {
    if (method === 'GET') {
      return await TaskModel.find().lean();
    }
    if (method === 'POST') {
      const body = await readBody(event);
      // Construct composite _id
      const task = new TaskModel({
        _id: {orgId: body.orgId, taskId: body.taskId},
        title: body.title,
        description: body.description || 'Auto-generated description',
      });
      return await task.save();
    }
  }

  if (path.endsWith('/settings')) {
    let settings = await SettingsModel.findOne().lean();
    if (!settings) {
      settings = await SettingsModel.create({
        location: [52.3676, 4.9041],
        preferences: {theme: 'dark', notifications: 'enabled'},
        metadata: new Map([
          ['env', 'production'],
          ['version', '1.0.0'],
        ]),
      });
    }
    return settings;
  }

  if (path.endsWith('/activities')) {
    if (method === 'GET') {
      return await ActivityModel.find().sort({timestamp: -1}).limit(10).lean();
    }
    if (method === 'POST') {
      const body = await readBody(event);
      return await ActivityModel.create(body);
    }
  }

  if (path.endsWith('/assets')) {
    if (method === 'GET') {
      return await AssetModel.find().limit(5).lean();
    }
    if (method === 'POST') {
      const body = await readBody(event);
      return await AssetModel.create({
        ...body,
        data: Buffer.from(body.data || 'Hello World'),
      });
    }
  }
  throw createError({statusCode: 404, message: 'Not Found'});
});
