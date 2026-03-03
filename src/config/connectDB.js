const mongoose = require("mongoose");

async function connectDB(mongoUri) {
  if (!mongoUri) {
    throw new Error("MONGO_URI is not set");
  }

  await mongoose.connect(mongoUri);
}

module.exports = connectDB;
