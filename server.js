const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= DATABASE CONNECTION =================
const dbConfig = {
  host: process.env.DB_HOST || "cpanel-h45.registrar-servers.com",
  user: process.env.DB_USER || "spinwindraw_casino",
  password: process.env.DB_PASSWORD || "Uganda@2026",
  database: process.env.DB_NAME || "spinwindraw_casino",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

// Initialize database connection pool
async function initDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    
    // Test connection
    const connection = await pool.getConnection();
    console.log("✅ Connected to MySQL database");
    console.log(`📍 Connected to: ${dbConfig.host}:${dbConfig.port}`);
    connection.release();

    // Create users table if it doesn't exist
    const [result] = await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstName VARCHAR(100),
        lastName VARCHAR(100),
        username VARCHAR(100) UNIQUE,
        email VARCHAR(100) UNIQUE,
        phone VARCHAR(20),
        password VARCHAR(255),
        balance INT DEFAULT 0
      )
    `);
    console.log("✅ Users table ready");
  } catch (err) {
    console.error("❌ Database error:", err.message);
    console.error("Full error:", err);
    process.exit(1); // Exit if can't connect to database
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

    await pool.execute(
      `INSERT INTO users (firstName, lastName, username, email, phone, password)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, username, email, phone, hashedPassword]
    );

    res.json({ success: true, message: "Account created successfully" });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
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
    const [rows] = await pool.execute(
      `SELECT * FROM users WHERE phone = ?`,
      [phone]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: "Invalid phone number or password" });
    }

    const user = rows[0];
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
    const [rows] = await pool.execute(
      `SELECT balance FROM users WHERE id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    res.json({ success: true, balance: rows[0].balance });
  } catch (err) {
    console.error("Balance error:", err);
    res.json({ success: false, message: "Server error" });
  }
});

// ================= UPDATE USER BALANCE =================
app.post("/api/user/:id/balance", async (req, res) => {
  const { amount } = req.body;

  try {
    await pool.execute(
      `UPDATE users SET balance = balance + ? WHERE id = ?`,
      [amount, req.params.id]
    );

    const [rows] = await pool.execute(
      `SELECT balance FROM users WHERE id = ?`,
      [req.params.id]
    );

    res.json({ success: true, balance: rows[0].balance });
  } catch (err) {
    console.error("Update balance error:", err);
    res.json({ success: false, message: "Server error" });
  }
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
