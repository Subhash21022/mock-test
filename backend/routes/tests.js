const express = require('express');
const router = express.Router();
const { readDb, writeDb } = require('../jsonDb');

// Seeded PRNG (mulberry32) — produces deterministic random numbers from a seed
function mulberry32(seed) {
    return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Fisher-Yates shuffle using a seeded PRNG
function seededShuffle(array, seed) {
    const shuffled = [...array];
    const rng = mulberry32(seed);
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

module.exports = () => {

    // GET /api/tests - List all tests
    router.get('/', (req, res) => {
        try {
            const db = readDb();
            const testsWithDetails = db.tests.map(t => {
                const creator = db.users.find(u => u.id === t.created_by);
                return {
                    ...t,
                    creator_name: creator ? creator.name : 'Unknown',
                    question_count: t.questions ? t.questions.length : 0,
                    problem_count: t.problems ? t.problems.length : 0
                };
            }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            res.json(testsWithDetails);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching tests', error: error.message });
        }
    });

    // GET /api/tests/count - Dashboard count
    router.get('/count', (req, res) => {
        try {
            const db = readDb();
            res.json({ total: db.tests.length });
        } catch (error) {
            res.status(500).json({ message: 'Error fetching count', error: error.message });
        }
    });

    // GET /api/tests/:id - Get test with all questions/problems
    // If ?student_id=<id> is provided and the test is a quiz, questions are
    // shuffled in a deterministic order unique to that student+test combination.
    router.get('/:id', (req, res) => {
        try {
            const { id } = req.params;
            const { student_id } = req.query;
            const db = readDb();
            const test = db.tests.find(t => String(t.id) === String(id));
            
            if (!test) {
                return res.status(404).json({ message: 'Test not found' });
            }

            // If a student is requesting a quiz, shuffle the questions
            if (student_id && test.test_type === 'quiz' && test.questions && test.questions.length > 0) {
                const seed = parseInt(student_id, 10) * 1000 + parseInt(id, 10);
                const shuffledQuestions = seededShuffle(test.questions, seed).map((q, i) => ({
                    ...q,
                    question_number: i + 1  // renumber after shuffle
                }));
                return res.json({ ...test, questions: shuffledQuestions });
            }

            res.json(test);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching test', error: error.message });
        }
    });

    // POST /api/tests/quiz - Create a quiz test
    router.post('/quiz', (req, res) => {
        try {
            const { title, description, duration_minutes, questions, created_by } = req.body;
            const db = readDb();

            const newTestId = db.tests.length > 0 ? Math.max(...db.tests.map(t => t.id)) + 1 : 1;
            
            const newTest = {
                id: newTestId,
                title,
                description,
                test_type: 'quiz',
                duration_minutes: duration_minutes || 60,
                created_by: created_by || 1,
                pass_key: req.body.pass_key || '',
                is_published: true,
                created_at: new Date().toISOString(),
                questions: questions.map((q, i) => ({
                    ...q,
                    question_number: i + 1,
                    marks: q.marks || 1
                }))
            };

            db.tests.push(newTest);
            writeDb(db);

            res.status(201).json({ message: 'Quiz test created successfully', test: newTest });
        } catch (error) {
            res.status(500).json({ message: 'Error creating quiz', error: error.message });
        }
    });

    // POST /api/tests/code - Create a code test
    router.post('/code', (req, res) => {
        try {
            const { title, description, duration_minutes, problems, created_by } = req.body;
            const db = readDb();

            const newTestId = db.tests.length > 0 ? Math.max(...db.tests.map(t => t.id)) + 1 : 1;

            const newTest = {
                id: newTestId,
                title,
                description,
                test_type: 'code',
                duration_minutes: duration_minutes || 90,
                created_by: created_by || 1,
                pass_key: req.body.pass_key || '',
                is_published: true,
                created_at: new Date().toISOString(),
                problems: problems.map((p, i) => ({
                    ...p,
                    problem_number: i + 1,
                    marks: p.marks || 10,
                    test_cases: (p.test_cases || []).map(tc => ({
                        ...tc,
                        is_hidden: tc.is_hidden || false
                    }))
                }))
            };

            db.tests.push(newTest);
            writeDb(db);

            res.status(201).json({ message: 'Code test created successfully', test: newTest });
        } catch (error) {
            res.status(500).json({ message: 'Error creating code test', error: error.message });
        }
    });

    // POST /api/tests/:id/verify-passkey - Verify pass key
    router.post('/:id/verify-passkey', (req, res) => {
        try {
            const { id } = req.params;
            const { passKey } = req.body;
            const db = readDb();
            const test = db.tests.find(t => String(t.id) === String(id));
            
            if (!test) {
                return res.status(404).json({ message: 'Test not found' });
            }

            if (test.pass_key && test.pass_key !== passKey) {
                return res.status(401).json({ message: 'Incorrect pass key', valid: false });
            }

            res.json({ message: 'Pass key verified', valid: true });
        } catch (error) {
            res.status(500).json({ message: 'Error verifying pass key', error: error.message });
        }
    });

    // PUT /api/tests/:id/publish - Toggle publish
    router.put('/:id/publish', (req, res) => {
        try {
            const { id } = req.params;
            const db = readDb();
            const testIndex = db.tests.findIndex(t => String(t.id) === String(id));
            
            if (testIndex === -1) {
                return res.status(404).json({ message: 'Test not found' });
            }

            db.tests[testIndex].is_published = !db.tests[testIndex].is_published;
            writeDb(db);

            res.json({ message: 'Test publish status updated', test: db.tests[testIndex] });
        } catch (error) {
            res.status(500).json({ message: 'Error updating test', error: error.message });
        }
    });

    // DELETE /api/tests/:id - Delete test
    router.delete('/:id', (req, res) => {
        try {
            const { id } = req.params;
            const db = readDb();
            
            db.tests = db.tests.filter(t => String(t.id) !== String(id));
            // Also delete associated results
            db.test_results = db.test_results.filter(tr => String(tr.test_id) !== String(id));
            
            writeDb(db);
            res.json({ message: 'Test deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Error deleting test', error: error.message });
        }
    });

    return router;
};
