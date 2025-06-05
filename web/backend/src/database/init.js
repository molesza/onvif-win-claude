const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

async function initializeDatabase() {
  const dbPath = process.env.DATABASE_PATH || './data/metrics.db';
  const dbDir = path.dirname(dbPath);

  // Ensure directory exists
  await fs.mkdir(dbDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Failed to open database:', err);
        reject(err);
        return;
      }

      logger.info('Connected to SQLite database');

      db.serialize(() => {
        // Users table
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Metrics table
        db.run(`
          CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            type TEXT NOT NULL,
            value REAL NOT NULL,
            metadata TEXT
          )
        `);

        // Create indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(type)`);

        // Alerts table
        db.run(`
          CREATE TABLE IF NOT EXISTS alert_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            metric TEXT NOT NULL,
            operator TEXT NOT NULL,
            threshold REAL NOT NULL,
            duration TEXT NOT NULL,
            actions TEXT NOT NULL,
            enabled BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Alert history
        db.run(`
          CREATE TABLE IF NOT EXISTS alert_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_id INTEGER NOT NULL,
            triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            value REAL NOT NULL,
            resolved_at DATETIME,
            FOREIGN KEY (rule_id) REFERENCES alert_rules(id)
          )
        `);

        // NVR configurations
        db.run(`
          CREATE TABLE IF NOT EXISTS nvr_configs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            ip TEXT NOT NULL,
            username TEXT NOT NULL,
            password TEXT,
            camera_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'offline',
            last_seen DATETIME,
            config_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create default admin user if it doesn't exist
        const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
        const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';

        db.get('SELECT id FROM users WHERE username = ?', [defaultUsername], async (err, row) => {
          if (!row) {
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            db.run(
              'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
              [defaultUsername, hashedPassword, 'admin'],
              (err) => {
                if (err) {
                  logger.error('Failed to create default admin user:', err);
                } else {
                  logger.info(`Default admin user created: ${defaultUsername}`);
                }
              }
            );
          }
        });

        // Store database instance globally
        global.db = db;
        resolve(db);
      });
    });
  });
}

module.exports = { initializeDatabase };