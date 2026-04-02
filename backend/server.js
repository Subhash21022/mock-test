const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const { readDb, writeDb } = require('./jsonDb.js');
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

// Seed data route - restores initial DB state for db.json
app.get('/api/seed', async (req, res) => {
    try {
        const initialDbState = {
            "users": [
                { "id": 1, "registrationNumber": "admin@gmail.com", "rollNumber": "123", "role": "admin", "name": "Admin", "department": "HQ", "classSection": "A", "emailId": "admin@gmail.com" },
                { "id": 2, "name": "Alice Smith", "rollNumber": "R1001", "department": "CSE", "registrationNumber": "REG2001", "classSection": "A", "emailId": "alice@gmail.com", "role": "student" },
                { "id": 3, "name": "Bob Johnson", "rollNumber": "R1002", "department": "ECE", "registrationNumber": "REG2002", "classSection": "B", "emailId": "bob@gmail.com", "role": "student" },
                { "id": 4, "name": "Charlie Davis", "rollNumber": "R1003", "department": "CSE", "registrationNumber": "REG2003", "classSection": "C", "emailId": "charlie@gmail.com", "role": "student" },
                { "id": 5, "name": "Diana Evans", "rollNumber": "R1004", "department": "EEE", "registrationNumber": "REG2004", "classSection": "A", "emailId": "diana@gmail.com", "role": "student" },
                { "id": 6, "name": "Ethan White", "rollNumber": "R1005", "department": "IT", "registrationNumber": "REG2005", "classSection": "B", "emailId": "ethan@gmail.com", "role": "student" },
                { "id": 7, "name": "Fiona Green", "rollNumber": "R1006", "department": "CSE", "registrationNumber": "REG2006", "classSection": "C", "emailId": "fiona@gmail.com", "role": "student" },
                { "id": 8, "name": "George Hall", "rollNumber": "R1007", "department": "ECE", "registrationNumber": "REG2007", "classSection": "A", "emailId": "george@gmail.com", "role": "student" },
                { "id": 9, "name": "Hannah King", "rollNumber": "R1008", "department": "EEE", "registrationNumber": "REG2008", "classSection": "B", "emailId": "hannah@gmail.com", "role": "student" },
                { "id": 10, "name": "Ian Lewis", "rollNumber": "R1009", "department": "IT", "registrationNumber": "REG2009", "classSection": "C", "emailId": "ian@gmail.com", "role": "student" },
                { "id": 11, "name": "Julia Martin", "rollNumber": "R1010", "department": "CSE", "registrationNumber": "REG2010", "classSection": "A", "emailId": "julia@gmail.com", "role": "student" },
                { "id": 12, "name": "Demo Student", "emailId": "student@gmail.com", "role": "student", "department": "CSE", "classSection": "A", "rollNumber": "123", "registrationNumber": "student@gmail.com" }
            ],
            "tests": [
                {
                    "id": 1,
                    "title": "Sample Quiz Test",
                    "description": "A basic quiz to test your knowledge.",
                    "test_type": "quiz",
                    "duration_minutes": 30,
                    "created_by": 1,
                    "is_published": true,
                    "created_at": new Date().toISOString(),
                    "questions": [
                        { "question_number": 1, "question_text": "What is 2 + 2?", "option_a": "3", "option_b": "4", "option_c": "5", "option_d": "6", "correct_option": "B", "marks": 1 }
                    ]
                },
                {
                    "id": 2,
                    "title": "Sample Code Test",
                    "description": "Write a program that prints 'Hello World!' to the console.",
                    "test_type": "code",
                    "duration_minutes": 60,
                    "created_by": 1,
                    "is_published": true,
                    "created_at": new Date().toISOString(),
                    "problems": [
                        {
                            "problem_number": 1, "title": "Print Hello World", "description": "Print exactly 'Hello World!' without the quotes.",
                            "input_format": "None", "output_format": "Hello World!", "constraints_text": "None", "sample_input": "", "sample_output": "Hello World!", "marks": 10,
                            "test_cases": [ { "input": "", "expected_output": "Hello World!", "is_hidden": false } ]
                        }
                    ]
                }
            ],
            "test_results": []
        };
        
        writeDb(initialDbState);
        res.status(201).json({ message: 'JSON Database seeded successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error seeding database', error: error.message });
    }
});

// Login Route
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const db = readDb();

        const user = db.users.find(u => u.emailId === username);

        if (user && user.registrationNumber === password) {
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
