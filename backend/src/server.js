require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { getFrontendOrigin } = require('./utils/runtimeConfig');

const puzzlesRouter = require('./routes/puzzles');
const ordersRouter = require('./routes/orders');
const webhooksRouter = require('./routes/webhooks');
const interestRouter = require('./routes/interest');
const analyticsRouter = require('./routes/analytics');
const adminRouter = require('./routes/admin');
const { router: pricingRouter } = require('./routes/pricing');
const testRouter = require('./routes/test');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database


// Global Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false // Allow loading upload assets in the browser
}));

app.use(cors({
  origin: getFrontendOrigin(),
  credentials: true
}));

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Increase body parser limit to support base64 image strings (15MB cap)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Serve saved crop images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Database connection middleware for Vercel Serverless
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({ error: "Database connection failed" });
  }
});

// Routes
app.use('/api/puzzles', puzzlesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/interest', interestRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/test', testRouter);

// Base Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'JIGZO full-stack foundation API is running.' });
});

// Centralized Error Handler
app.use(errorHandler);

// Start the API only after MongoDB connects successfully
const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[JIGZO Server] Running on port ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;
