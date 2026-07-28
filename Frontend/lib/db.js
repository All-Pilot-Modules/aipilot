// lib/getDb.js
const { Client } = require('pg');

const DB_URLS = {
  IEP_LAURA: process.env.IEP_LAURA_DATABASE_URL,
  IEP_ZHANG: process.env.IEP_ZHANG_DATABASE_URL,
  AUTISM_ZHANG: process.env.AUTISM_ZHANG_DATABASE_URL,
};

async function getDb(moduleKey) {
  const connString = DB_URLS[moduleKey];
  if (!connString) throw new Error(`Database URL not found for ${moduleKey}`);

  const client = new Client({
    connectionString: connString,
    ssl: { rejectUnauthorized: true },
  });

  await client.connect(); // <-- This is critical
  return client;
}

module.exports = { getDb };