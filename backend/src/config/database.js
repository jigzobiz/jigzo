const mongoose = require('mongoose');

let cached = global.mongooseConnection;

if (!cached) {
  cached = global.mongooseConnection = {
    connection: null,
    promise: null
  };
}

const connectDB = async () => {
  if (cached.connection) {
    return cached.connection;
  }

  let connStr = process.env.MONGODB_URI;

  if (connStr) {
    connStr = connStr.trim().replace(/^["']|["']$/g, '');
    if (!connStr.startsWith('mongodb://') && !connStr.startsWith('mongodb+srv://')) {
      connStr = `mongodb+srv://jigzo_staging:${connStr}@jigzo-dev.vyfbeoh.mongodb.net/jigzo_test?retryWrites=true&w=majority&appName=jigzo-dev`;
    }
  }

  if (!connStr) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (!cached.promise) {
    console.log('Connecting to MongoDB...');
    cached.promise = mongoose.connect(connStr, {
      serverSelectionTimeoutMS: 10000
    });
  }

  try {
    cached.connection = await cached.promise;
    console.log('MongoDB Connected Successfully.');
    return cached.connection;
  } catch (error) {
    cached.promise = null;
    console.error('MongoDB Connection Error:', error.message);
    throw error;
  }
};

module.exports = connectDB;
