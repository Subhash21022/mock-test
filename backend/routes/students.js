const express = require('express');
const router = express.Router();
const multer = require('multer');
const Papa = require('papaparse');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { readDb, writeDb } = require('../jsonDb');

module.exports = () => {

    // GET /api/students - List all students with optional filters
    router.get('/', (req, res) => {
        try {
            const { search, department, classSection } = req.query;
            const db = readDb();
            
            let students = db.users.filter(u => u.role === 'student');

            if (search) {
                const searchLower = search.toLowerCase();
                students = students.filter(s => 
                    (s.name && s.name.toLowerCase().includes(searchLower)) || 
                    (s.emailId && s.emailId.toLowerCase().includes(searchLower)) || 
                    (s.rollNumber && s.rollNumber.toLowerCase().includes(searchLower)) ||
                    (s.registrationNumber && s.registrationNumber.toLowerCase().includes(searchLower))
                );
            }
            if (department) {
                students = students.filter(s => s.department === department);
            }
            if (classSection) {
                students = students.filter(s => s.classSection === classSection);
            }

            // Remove passwords from response (in our case rollNumber is password, but we might want to return rollNumber to UI)
            // It's requested to be returned in Dashboard so we will leave it for students.
            students = students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            
            res.json(students);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching students', error: error.message });
        }
    });

    // GET /api/students/count - Dashboard count
    router.get('/count', (req, res) => {
        try {
            const db = readDb();
            const count = db.users.filter(u => u.role === 'student').length;
            res.json({ total: count });
        } catch (error) {
            res.status(500).json({ message: 'Error fetching count', error: error.message });
        }
    });

    // GET /api/students/template - Download CSV template
    router.get('/template', (req, res) => {
        const csvContent = 'FULL NAME,EMAIL (LOGIN ID),REGISTER NUMBER (PASSWORD),ROLL NO,DEPARTMENT,SECTION\nStudent full name,student@gmail.com,312324xxx,R1001,CSE,A\n';
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=student_template.csv');
        res.send(csvContent);
    });

    // POST /api/students - Create single student
    router.post('/', (req, res) => {
        try {
            const { name, emailId, registrationNumber, rollNumber, department, classSection } = req.body;
            const db = readDb();

            if (db.users.some(u => u.registrationNumber === registrationNumber)) {
                return res.status(409).json({ message: 'A student with this registration number already exists' });
            }

            const newId = db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1;
            
            const newStudent = {
                id: newId,
                name,
                emailId,
                role: 'student',
                rollNumber,
                registrationNumber,
                department,
                classSection
            };

            db.users.push(newStudent);
            writeDb(db);

            res.status(201).json({ message: 'Student created successfully', student: newStudent });
        } catch (error) {
            res.status(500).json({ message: 'Error creating student', error: error.message });
        }
    });

    // POST /api/students/bulk - Bulk upload from CSV
    const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

    router.post('/bulk', upload.single('file'), (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const department = req.body.department || 'CSE';
            const fileExt = path.extname(req.file.originalname).toLowerCase();
            let parsedData = [];

            if (fileExt === '.csv') {
                const csvFile = fs.readFileSync(req.file.path, 'utf8');
                const parsed = Papa.parse(csvFile, { header: true, skipEmptyLines: true });
                if (parsed.errors.length > 0) {
                    fs.unlinkSync(req.file.path);
                    return res.status(400).json({ message: 'CSV parsing error', errors: parsed.errors });
                }
                parsedData = parsed.data;
            } else if (fileExt === '.xlsx' || fileExt === '.xls') {
                const workbook = xlsx.readFile(req.file.path);
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                parsedData = xlsx.utils.sheet_to_json(sheet, { defval: "" });
            } else {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: 'Unsupported file type. Please upload a CSV or Excel file.' });
            }

            // Normalize header keys: trim spaces from keys so that " REGISTER NUMBER " becomes "REGISTER NUMBER"
            parsedData = parsedData.map(row => {
                const normalizedRow = {};
                for (const key in row) {
                    if (Object.prototype.hasOwnProperty.call(row, key)) {
                        normalizedRow[key.trim()] = row[key];
                    }
                }
                return normalizedRow;
            });

            const db = readDb();
            let insertedCount = 0;
            let skippedCount = 0;
            const errors = [];
            
            let currentId = db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1;

            for (const row of parsedData) {
                // Robust mapping: check for exact headers and common variations
                const name = (row['FULL NAME'] || row['Name'] || row['name'] || '').toString().trim();
                const emailId = (row['EMAIL (LOGIN ID)'] || row['EMAIL'] || row['Email'] || row['email'] || '').toString().trim();
                const rollNumber = (row['ROLL NO'] || row['ROLL NO (PASSWORD)'] || row['Roll No'] || row['rollNo'] || row['Roll no'] || '').toString().trim();
                const registrationNumber = (row['REGISTER NUMBER (PASSWORD)'] || row['REGISTER NUMBER (USERNAME)'] || row['REGISTER NUMBER'] || row['REG NO'] || row['Reg No'] || row['regNo'] || '').toString().trim();
                const section = (row['SECTION'] || row['CLASS / SECTION'] || row['Section'] || row['class'] || row['CLASS'] || row['Class'] || '').toString().trim();
                const rowDepartment = (row['DEPARTMENT'] || row['Department'] || row['department'] || '').toString().trim();

                if (!name || (!emailId && !registrationNumber)) {
                    skippedCount++;
                    errors.push({ row: row, error: "Missing required fields (Name, Email, or Register Number)" });
                    continue;
                }

                if (registrationNumber && db.users.some(u => u.registrationNumber === registrationNumber)) {
                    skippedCount++;
                    errors.push({ registrationNumber, error: "Registration Number already exists" });
                    continue;
                }

                db.users.push({
                    id: currentId++,
                    name: name.trim(),
                    emailId: emailId.trim(),
                    role: 'student',
                    rollNumber: rollNumber.trim(),
                    registrationNumber: registrationNumber,
                    department: rowDepartment || department,
                    classSection: section
                });
                insertedCount++;
            }

            writeDb(db);
            fs.unlinkSync(req.file.path);

            res.status(201).json({
                message: `Bulk upload complete. ${insertedCount} students created, ${skippedCount} skipped.`,
                inserted: insertedCount,
                skipped: skippedCount,
                errors
            });
        } catch (error) {
            res.status(500).json({ message: 'Error processing bulk upload', error: error.message });
        }
    });

    // PUT /api/students/:id/profile-pic - Update profile image
    router.put('/:id/profile-pic', (req, res) => {
        try {
            const { id } = req.params;
            const { profile_image } = req.body;
            const db = readDb();
            
            const studentIndex = db.users.findIndex(u => String(u.id) === String(id) && u.role === 'student');
            
            if (studentIndex === -1) {
                return res.status(404).json({ message: 'Student not found' });
            }
            
            db.users[studentIndex].profile_image = profile_image;
            writeDb(db);
            
            res.json({ message: 'Profile picture updated successfully', user: { id: db.users[studentIndex].id, profile_image } });
        } catch (error) {
            res.status(500).json({ message: 'Error updating profile picture', error: error.message });
        }
    });

    // DELETE /api/students/:id - Delete student
    router.delete('/:id', (req, res) => {
        try {
            const { id } = req.params;
            const db = readDb();
            
            db.users = db.users.filter(u => !(String(u.id) === String(id) && u.role === 'student'));
            // Remove test results as well
            db.test_results = db.test_results.filter(tr => String(tr.student_id) !== String(id));
            
            writeDb(db);
            res.json({ message: 'Student deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error deleting student', error: error.message });
        }
    });

    return router;
};
