export class MongooseZodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MongooseZodError';
    Object.setPrototypeOf(this, MongooseZodError.prototype);
  }
}
