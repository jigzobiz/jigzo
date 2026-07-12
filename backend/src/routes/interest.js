const express = require('express');
const router = express.Router();
const Interest = require('../models/Interest');

router.post('/', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    // Save interest entry to MongoDB
    const interest = new Interest({ email });
    await interest.save();

    res.status(201).json({
      success: true,
      message: "You're on the list! We'll notify you soon."
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

module.exports = router;
