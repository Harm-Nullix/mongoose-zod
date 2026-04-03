import {describe, it, expect, beforeAll, afterAll} from 'bun:test';
import {z} from 'zod';
import mongoose from 'mongoose';
import {MongoMemoryServer} from 'mongodb-memory-server';
import {toMongooseSchema, extractMongooseDef} from '../src/index.js';

let mongoServer: MongoMemoryServer;

describe('Discriminator Unions', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('should extract a structured POJO for discriminated unions', () => {
    const MyEventSchema = z.discriminatedUnion('kind', [
      z.object({kind: z.literal('clicked'), url: z.string()}),
      z.object({kind: z.literal('purchased'), productId: z.string(), amount: z.number()}),
    ]);

    const def = extractMongooseDef(MyEventSchema) as any;
    expect(def.__isDiscriminatorUnion).toBe(true);
    expect(def.discriminatorKey).toBe('kind');
    expect(def.discriminators).toHaveProperty('clicked');
    expect(def.discriminators).toHaveProperty('purchased');

    // Check one of the discriminators
    expect(def.discriminators.clicked.url.type).toBe(String);
  });

  it('should create a top-level Mongoose schema with discriminators', async () => {
    const MyEventZod = z.discriminatedUnion('kind', [
      z.object({kind: z.literal('clicked'), url: z.string(), time: z.coerce.date()}),
      z.object({
        kind: z.literal('purchased'),
        productId: z.string(),
        amount: z.number(),
        time: z.coerce.date(),
      }),
    ]);

    const schema = toMongooseSchema(MyEventZod);
    const EventModel = mongoose.model('TopLevelEvent', schema);

    expect(EventModel.discriminators).toHaveProperty('clicked');
    expect(EventModel.discriminators).toHaveProperty('purchased');

    const clicked = new EventModel({kind: 'clicked', url: 'https://test.com', time: new Date()});
    await clicked.save();

    const saved = await EventModel.findOne();
    expect(saved).toHaveProperty('url', 'https://test.com');
    expect(saved).toHaveProperty('time');
  });

  it('should handle nested discriminated unions', async () => {
    const UserSchema = z.object({
      name: z.string(),
      event: z.discriminatedUnion('kind', [
        z.object({kind: z.literal('clicked'), url: z.string()}),
        z.object({kind: z.literal('purchased'), productId: z.string()}),
      ]),
    });

    const schema = toMongooseSchema(UserSchema);
    const UserModel = mongoose.model('UserWithNestedDiscriminator', schema);

    const user = new UserModel({
      name: 'John',
      event: {kind: 'clicked', url: 'https://nested.com'},
    });
    await user.save();

    const saved = await UserModel.findOne({name: 'John'});
    expect(saved.event).toHaveProperty('url', 'https://nested.com');
    expect(saved.event.kind).toBe('clicked');
  });

  it('should handle discriminated unions in arrays', async () => {
    const LogSchema = z.object({
      entries: z.array(
        z.discriminatedUnion('type', [
          z.object({type: z.literal('info'), message: z.string()}),
          z.object({type: z.literal('error'), code: z.number()}),
        ]),
      ),
    });

    const schema = toMongooseSchema(LogSchema);
    const LogModel = mongoose.model('LogWithArrayDiscriminator', schema);

    const log = new LogModel({
      entries: [
        {type: 'info', message: 'All good'},
        {type: 'error', code: 500},
      ],
    });
    await log.save();

    const saved = await LogModel.findOne();
    expect(saved.entries).toHaveLength(2);
    expect(saved.entries[0]).toHaveProperty('message', 'All good');
    expect(saved.entries[1]).toHaveProperty('code', 500);
  });
});
