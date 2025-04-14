const mongoose = require("mongoose");
const { logger } = require("./logger");
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error(err.message);
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectDB;