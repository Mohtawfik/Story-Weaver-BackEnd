const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";

// Use DATABASE_URL in production (Railway), otherwise, use local environment variables
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}`,
    ssl: isProduction ? { rejectUnauthorized: false } : false, // Enable SSL for cloud databases
});

pool.connect()
    .then(() => console.log("✅ PostgreSQL connected successfully"))
    .catch((err) => console.error("❌ PostgreSQL connection error:", err));

module.exports = pool;
