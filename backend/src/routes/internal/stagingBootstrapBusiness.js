const express = require('express');
const { bootstrapStagingBusiness } = require('../../services/stagingBusinessBootstrap');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const result = await bootstrapStagingBusiness();
    return res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.code });
    return next(error);
  }
});

module.exports = router;
