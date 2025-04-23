const mongoose = require("mongoose");

const ChatsSchema = mongoose.model("Bridge-Chats", new mongoose.Schema({
  id: String,
  name: String,
  messages: [{
    id: String,
    sender: String,
    text: String,
    date: Date,
  }],
}));

module.exports = { ChatsSchema }
