const { Pool, Client } = require('pg');

const dbConfig = {
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'tahataha',
};

async function ensureDatabase() {
  const client = new Client({ ...dbConfig, database: 'postgres' });
  try {
    await client.connect();
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'chatvora_db'"
    );
    if (res.rowCount === 0) {
      await client.query('CREATE DATABASE chatvora_db');
      console.log('Database "chatvora_db" created.');
    } else {
      console.log('Database "chatvora_db" already exists.');
    }
  } catch (err) {
    console.error('Error ensuring database exists:', err);
    throw err;
  } finally {
    await client.end();
  }
}

const pool = new Pool({ ...dbConfig, database: 'chatvora_db' });

module.exports = { pool, ensureDatabase, query: (text, params) => pool.query(text, params) };
