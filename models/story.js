const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid"); // Import UUID generator

const storySchema = new mongoose.Schema({
    story_id: { type: String, unique: true, required: true, default: uuidv4 }, // Explicit story_id
    user_id: { type: String, required: true }, // User who saved the story
    title: { type: String, required: true },  // Title of the story
    story: { type: String, required: true },  // Full story text
    keywords: [String],                      // Tags or keywords
    length: { type: String, required: true }, // Story length
    created_at: { type: Date, default: Date.now }, // Timestamp
});

const Story = mongoose.model("Story", storySchema);

module.exports = Story;
