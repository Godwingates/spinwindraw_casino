const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= DATABASE CONNECTION =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database
async function initDatabase() {
  try {
    // Test connection
    const client = await pool.connect();
    console.log("✅ Connected to PostgreSQL database");
    client.release();

    // Create users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        firstName VARCHAR(100),
        lastName VARCHAR(100),
        username VARCHAR(100) UNIQUE,
        email VARCHAR(100) UNIQUE,
        phone VARCHAR(20),
        password VARCHAR(255),
        balance INTEGER DEFAULT 0
      )
    `);
    console.log("✅ Users table ready");
  } catch (err) {
    console.error("❌ Database error:", err.message);
    console.error("Full error:", err);
    process.exit(1);
  }
}

initDatabase();

// ================= HEALTH CHECK ENDPOINT =================
app.get("/", (req, res) => {
  res.json({ 
    status: "Server is running", 
    message: "Casino API is live" 
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ================= SIGNUP =================
app.post("/api/signup", async (req, res) => {
  const { firstName, lastName, username, email, phone, password } = req.body;

  if (!firstName || !lastName || !username || !email || !phone || !password) {
    return res.json({ success: false, message: "All fields required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (firstName, lastName, username, email, phone, password)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [firstName, lastName, username, email, phone, hashedPassword]
    );

    res.json({ success: true, message: "Account created successfully" });
  } catch (err) {
    if (err.code === '23505') { // PostgreSQL unique violation
      return res.json({ success: false, message: "Username, email, or phone already exists" });
    }
    console.error("Signup error:", err);
    res.json({ success: false, message: "Server error" });
  }
});

// ================= LOGIN =================
app.post("/api/login", async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.json({ success: false, message: "Phone and password required" });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE phone = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, message: "Invalid phone number or password" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      return res.json({ success: false, message: "Invalid phone number or password" });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.json({ success: false, message: "Server error" });
  }
});

// ================= GET USER BALANCE =================
app.get("/api/user/:id/balance", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT balance FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({ success: true, balance: result.rows[0].balance });
  } catch (err) {
    console.error("Balance error:", err);
    res.json({ success: false, message: "Server error" });
  }
});

// ================= UPDATE USER BALANCE =================
app.post("/api/user/:id/balance", async (req, res) => {
  const { amount } = req.body;

  try {
    await pool.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2`,
      [amount, req.params.id]
    );

    const result = await pool.query(
      `SELECT balance FROM users WHERE id = $1`,
      [req.params.id]
    );

    res.json({ success: true, balance: result.rows[0].balance });
  } catch (err) {
    console.error("Update balance error:", err);
    res.json({ success: false, message: "Server error" });
  }
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
