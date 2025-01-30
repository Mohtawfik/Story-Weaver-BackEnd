require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Story = require("./models/story"); // MongoDB Story model

const app = express();
app.use(cors());
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid"); // Import UUID generator

const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/story-weaver";

mongoose
    .connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log("MongoDB connected successfully"))
    .catch((err) => console.error("MongoDB connection error:", err));

// **Register**
const pool = require("./db");

app.post("/auth/register", async (req, res) => {
    const { name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = await pool.query(
            "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *",
            [name, email, hashedPassword]
        );
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(409).json({ message: "User already exists" });
    }
});

app.get("/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({ success: true, time: result.rows[0].now });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});



// **Login**
app.post("/auth/login", async (req, res) => {
    const { email, password } = req.body;

    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
});

const axios = require("axios"); // Ensure axios is installed

// **Generate Story**
app.post("/generate-story", async (req, res) => {
    const { keywords, length } = req.body;

    if (!keywords || !length) {
        return res.status(400).json({ message: "Keywords and length are required" });
    }

    let wordCount;
    if (length === "Short") wordCount = 250;
    else if (length === "Medium") wordCount = 500;
    else if (length === "Full") wordCount = 1000;

    const prompt = `Write a ${length} story in ${wordCount} words using the following keywords: ${keywords.join(", ")}. Also, provide a fitting title for the story.`;

    try {
        // Groq API call
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.3-70b-versatile",
                max_tokens: Math.min(wordCount * 5, 4096),
                temperature: 0.7,
                top_p: 0.9,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const generatedText = response.data.choices[0].message.content;
        console.log(generatedText)
        // Extract the title and story from the response
        let [title, ...storyLines] = generatedText.split("\n");
        let story = storyLines.join("\n").trim();
        title = title.replace(/\*/g, "").trim();

        res.json({ title: title.trim(), story });
    } catch (error) {
        console.error("Error generating story:", error.response?.data || error.message);
        res.status(500).json({ message: "Failed to generate story." });
    }
});




app.get("/stories", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch only story_id, title, and keywords
        const stories = await Story.find(
            { user_id: decoded.id },
            "story_id title keywords"
        ).sort({ created_at: -1 });

        res.json(stories);
    } catch (error) {
        console.error("Error fetching stories:", error);
        res.status(401).json({ message: "Invalid or expired token." });
    }
});


app.get("/stories/:id", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch the story using `story_id`, not `_id`
        const story = await Story.findOne({ story_id: req.params.id, user_id: decoded.id });

        if (!story) return res.status(404).json({ message: "Story not found" });

        res.json({
            title: story.title,
            story: story.story,
            keywords: story.keywords,
            length: story.length,
        });
    } catch (error) {
        console.error("Error fetching story:", error);
        res.status(401).json({ message: "Invalid or expired token." });
    }
});

app.put("/stories/:id", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const updatedStory = await Story.findOneAndUpdate(
            { story_id: req.params.id, user_id: userId },
            { story: req.body.story },
            { new: true }
        );

        if (!updatedStory) return res.status(404).json({ message: "Story not found or unauthorized" });

        res.json({ message: "Story updated successfully!", updatedStory });
    } catch (error) {
        console.error("Error updating story:", error);
        res.status(500).json({ message: "Failed to update story." });
    }
});

app.delete("/stories/:storyId", async (req, res) => {
    try {
        const { storyId } = req.params;
        const deletedStory = await Story.findByIdAndDelete(storyId);

        if (!deletedStory) {
            return res.status(404).json({ message: "Story not found" });
        }

        res.json({ message: "Story deleted successfully!" });
    } catch (error) {
        console.error("Error deleting story:", error);
        res.status(500).json({ message: "Server error while deleting story." });
    }
});













app.post("/stories", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1]; // Extract token from Authorization header

    if (!token) {
        return res.status(401).json({ message: "Unauthorized. Token is required." });
    }

    try {
        console.log("Token Received:", token);

        const decoded = jwt.verify(token, JWT_SECRET);
        console.log("Decoded Token:", decoded);

        const userId = decoded.id;

        const storyId = uuidv4();

        const newStory = new Story({
            story_id: storyId,
            user_id: userId,
            title: req.body.title,
            story: req.body.story,
            keywords: req.body.keywords,
            length: req.body.length,
        });

        await newStory.save();
        res.status(201).json({ message: "Story saved successfully!", story_id: storyId });
    } catch (error) {
        console.error("Error verifying token:", error);
        res.status(401).json({ message: "Invalid or expired token." });
    }
});







// Start the server
const PORT = 5001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
