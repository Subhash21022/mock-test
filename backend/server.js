const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const { readDb, writeDb, initDbFromPostgres } = require('./jsonDb.js');
const studentsRoutes = require('./routes/students.js');
const testsRoutes = require('./routes/tests.js');
const resultsRoutes = require('./routes/results.js');
const compilerRoutes = require('./routes/compiler.js');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Mount route modules - no need for pool anymore
app.use('/api/students', studentsRoutes());
app.use('/api/tests', testsRoutes());
app.use('/api/results', resultsRoutes());
app.use('/api/compile', compilerRoutes());

// Seed data route - restores initial DB state for postgres
app.get('/api/seed', async (req, res) => {
    try {
        const initialDbState = {
            "users": [
                { "id": 1, "registrationNumber": "admin@gmail.com", "rollNumber": "123", "role": "admin", "name": "Admin", "department": "HQ", "classSection": "A", "emailId": "admin@gmail.com" },
                { "id": 2, "name": "Demo Student", "emailId": "student@gmail.com", "role": "student", "department": "CSE", "classSection": "A", "rollNumber": "123", "registrationNumber": "student@gmail.com" }
            ],
            "tests": [],
            "test_results": []
        };
        
        writeDb(initialDbState);
        res.status(201).json({ message: 'Postgres Database seeded successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error seeding database', error: error.message });
    }
});

// Login Route
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const db = readDb();

        const usernameLower = String(username || '').toLowerCase().trim();
        const user = db.users.find(u => 
            (u.emailId && String(u.emailId).toLowerCase().trim() === usernameLower) || 
            (u.registrationNumber && String(u.registrationNumber).toLowerCase().trim() === usernameLower) ||
            (u.rollNumber && String(u.rollNumber).toLowerCase().trim() === usernameLower)
        );

        if (user && String(user.registrationNumber).trim() === String(password || '').trim()) {
            res.json({
                _id: user.id,
                email: user.emailId,
                role: user.role,
                name: user.name,
                profile_image: user.profile_image,
                registrationNumber: user.registrationNumber,
                rollNumber: user.rollNumber,
                department: user.department,
                classSection: user.classSection,
                message: 'Login successful'
            });
        } else {
            res.status(401).json({ message: 'Invalid email id or registration number' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

const PORT = process.env.PORT || 5000;

(async () => {
    await initDbFromPostgres();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
})();
