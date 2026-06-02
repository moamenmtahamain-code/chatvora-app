const express = require('express');
const cors = require('cors');
const { pool, ensureDatabase, query } = require('./db');
const { FindCursor } = require('mongodb');

const app = express();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

async function init() {
  try {
    await ensureDatabase();
    console.log('Database verified.');
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tables ready.');
  } catch (err) {
    console.error('Error creating tables:', err);
    process.exit(1);
  }

  app.post('/api/register', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rowCount > 0) {
        return res.status(400).json({ message: 'Email already exists.' });
      }

      await query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, password]);
      res.status(201).json({ message: 'User registered successfully.' });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ message: 'Internal server error.' });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      const result = await query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rowCount === 0 || result.rows[0].password !== password) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }

      const { password: _, ...userData } = result.rows[0];
      res.status(200).json({ message: 'Login successful.', user: userData });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Internal server error.' });
    }
  });

  app.listen(5000, () => {
    console.log('Chatvora server live on port 5000.');
  });
}

init();