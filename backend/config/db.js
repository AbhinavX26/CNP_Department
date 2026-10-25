import mongoose from 'mongoose';

let memoryServer = null;

const connectDB = async () => {
  let uri = process.env.MONGODB_URI;

  if (!uri || uri === 'YOUR_MONGODB_ATLAS_CONNECTION_STRING') {
    try {
      console.log('ℹ️  MONGODB_URI not found in backend/.env — starting in-memory MongoDB for local dev...');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
      console.log(`✅  In-memory MongoDB started at: ${uri}`);
    } catch (err) {
      console.error(
        '❌  MONGODB_URI is not set. Please add your MongoDB connection string to backend/.env'
      );
      process.exit(1);
    }
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅  MongoDB connected successfully → ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌  MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;

