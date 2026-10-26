import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

export async function start_mongo(): Promise<{
  uri: string;
  stop(): Promise<void>;
}> {
  const server = await MongoMemoryServer.create();
  return {
    uri: server.getUri(),
    stop: async () => {
      await server.stop();
    },
  };
}

/** MongooseModule for tests: fails fast instead of retrying forever. */
export function mongoose_test_module(uri: string) {
  return MongooseModule.forRoot(uri, {
    retryAttempts: 0,
    serverSelectionTimeoutMS: 5000,
  });
}
