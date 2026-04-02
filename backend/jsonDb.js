// jsonDb.js
const { pool } = require('./db.js');

let globalCache = null;

// Initialize cache from Postgres on startup
const initDbFromPostgres = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_state (
                id INTEGER PRIMARY KEY,
                data JSONB NOT NULL
            )
        `);
        
        const res = await pool.query('SELECT data FROM app_state WHERE id = 1');
        if (res.rows.length === 0) {
            // Seed default users
            const defaultState = {
                users: [
                    { "id": 1, "registrationNumber": "admin@gmail.com", "rollNumber": "123", "role": "admin", "name": "Admin", "department": "HQ", "classSection": "A", "emailId": "admin@gmail.com" },
                    { "id": 2, "name": "Demo Student", "emailId": "student@gmail.com", "role": "student", "department": "CSE", "classSection": "A", "rollNumber": "123", "registrationNumber": "student@gmail.com" }
                ],
                tests: [],
                test_results: []
            };
            await pool.query('INSERT INTO app_state (id, data) VALUES (1, $1)', [JSON.stringify(defaultState)]);
            globalCache = defaultState;
            console.log('Postgres app_state initialized with default seeding.');
        } else {
            globalCache = res.rows[0].data;
            console.log('Postgres app_state loaded into memory from Render DB.');
        }
    } catch (err) {
        console.error('Error initializing Postgres memory sync:', err);
    }
};

const readDb = () => {
    if (!globalCache) {
        // Fallback or early hits before initialization
        return { users: [], tests: [], test_results: [] };
    }
    // Return a deep copy so internal modifications don't mutate cache accidentally before writeDb is called
    return JSON.parse(JSON.stringify(globalCache));
};

const writeDb = (data) => {
    globalCache = JSON.parse(JSON.stringify(data));
    // Asynchronous background update to Postgres
    pool.query('UPDATE app_state SET data = $1 WHERE id = 1', [JSON.stringify(data)])
        .catch(err => console.error('Error writing to Postgres app_state:', err));
};

module.exports = { readDb, writeDb, initDbFromPostgres };
