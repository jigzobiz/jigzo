/**
 * Centralized Error Handling Middleware.
 */
const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler Log]:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      status: statusCode,
      // Only include stack trace during non-production runs
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    }
  });
};

module.exports = errorHandler;
