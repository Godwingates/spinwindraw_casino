-- Fresh PostgreSQL Database Setup for Casino App
-- This creates an empty users table ready for production

-- Drop the table if it exists (removes test users)
DROP TABLE IF EXISTS users;

-- Create fresh users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  firstName VARCHAR(100),
  lastName VARCHAR(100),
  username VARCHAR(100) UNIQUE,
  email VARCHAR(100) UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255),
  balance INTEGER DEFAULT 0
);

-- Table is now ready for production signups
