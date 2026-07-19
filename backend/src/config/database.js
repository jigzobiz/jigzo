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

  const connStr = process.env.MONGODB_URI;

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
