const mongoose = require("mongoose");

const ChatsSchema = mongoose.model("Bridge-Chats", new mongoose.Schema({
  telId: String,
  discId: String,
  name: String,
  webhook: String,
  messages: [{
    tgId: String,
    discId: String,
    date: Date,
  }],
}));

module.exports = { ChatsSchema }
