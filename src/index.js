require('dotenv').config();
const mongoose = require('./db');
const ready = require('./handlers/ready');

mongoose
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

ready();