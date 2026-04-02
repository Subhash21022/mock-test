import { API_BASE_URL } from '../../config';
import { useState, useRef } from 'react';
import * as mammoth from 'mammoth';

const parseTextToQuestions = (text: string) => {
    // Basic regex-based parser
    const questionBlocks = text.split(/(?=\n*\d+\.\s+)/).filter((b: string) => b.trim() !== '');
    const newQuestions: any[] = [];

    questionBlocks.forEach((block: string) => {
        let question_text = '';
        let option_a = '';
        let option_b = '';
        let option_c = '';
        let option_d = '';
        let correct_option = 'A';

        const lines = block.split('\n').map((l: string) => l.trim()).filter((l: string) => l);
        
        lines.forEach((line: string) => {
             if (/^\d+\.\s*(.+)/.test(line) && !question_text) {
                 question_text = line.replace(/^\d+\.\s*/, '').trim();
             } else if (/^[A][)\.]\s*(.+)/i.test(line)) {
                 option_a = line.replace(/^[A][)\.]\s*/i, '').trim();
             } else if (/^[B][)\.]\s*(.+)/i.test(line)) {
                 option_b = line.replace(/^[B][)\.]\s*/i, '').trim();
             } else if (/^[C][)\.]\s*(.+)/i.test(line)) {
                 option_c = line.replace(/^[C][)\.]\s*/i, '').trim();
             } else if (/^[D][)\.]\s*(.+)/i.test(line)) {
                 option_d = line.replace(/^[D][)\.]\s*/i, '').trim();
             } else if (/^Ans(wer)?:\s*([A-D])/i.test(line)) {
                 const matchResult = line.match(/^Ans(wer)?:\s*([A-D])/i);
                 if (matchResult && matchResult[2]) {
                     correct_option = matchResult[2].toUpperCase();
                 }
             } else if (question_text && !option_a && !/^[ABCD][)\.]\s*/i.test(line) && !/^Ans(wer)?/i.test(line)) {
                 question_text += " " + line;
             }
        });

        if (question_text && option_a && option_b && option_c && option_d) {
            newQuestions.push({
                question_text,
                option_a,
                option_b,
                option_c,
                option_d,
                correct_option,
                marks: 1
            });
        }
    });

    return newQuestions;
};

const emptyQuizQuestion = () => ({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    marks: 1,
});

const emptyCodeProblem = () => ({
    title: '',
    description: '',
    input_format: '',
    output_format: '',
    constraints_text: '',
    sample_input: '',
    sample_output: '',
    marks: 10,
    test_cases: [{ input: '', expected_output: '', is_hidden: false }],
});

const CreateTest = () => {
    const [testType, setTestType] = useState('quiz');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [duration, setDuration] = useState(60);
    const [passKey, setPassKey] = useState('');
    const [questions, setQuestions] = useState<any[]>([emptyQuizQuestion()]);
    const [problems, setProblems] = useState<any[]>([emptyCodeProblem()]);
    const [alert, setAlert] = useState<{type: string, message: string} | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Quiz handlers
    const addQuestion = () => {
        if (questions.length >= 30) return;
        setQuestions([...questions, emptyQuizQuestion()]);
    };

    const removeQuestion = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const updateQuestion = (index: number, field: string, value: string) => {
        const updated = [...questions];
        updated[index][field] = value;
        setQuestions(updated);
    };

    // Code handlers
    const addProblem = () => {
        if (problems.length >= 10) return;
        setProblems([...problems, emptyCodeProblem()]);
    };

    const removeProblem = (index: number) => {
        setProblems(problems.filter((_, i) => i !== index));
    };

    const updateProblem = (index: number, field: string, value: string | number) => {
        const updated = [...problems];
        updated[index][field] = value;
        setProblems(updated);
    };

    const addTestCase = (problemIndex: number) => {
        const updated = [...problems];
        updated[problemIndex].test_cases.push({ input: '', expected_output: '', is_hidden: false });
        setProblems(updated);
    };

    const removeTestCase = (problemIndex: number, tcIndex: number) => {
        const updated = [...problems];
        updated[problemIndex].test_cases = updated[problemIndex].test_cases.filter((_: any, i: number) => i !== tcIndex);
        setProblems(updated);
    };

    const updateTestCase = (problemIndex: number, tcIndex: number, field: string, value: string | boolean) => {
        const updated = [...problems];
        updated[problemIndex].test_cases[tcIndex][field] = value;
        setProblems(updated);
    };

    // File upload handlers
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processFile(file);
    };

    const processFile = async (file: File) => {
        setAlert(null);
        try {
            let text = '';
            if (file.name.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                text = result.value;
            } else if (file.name.endsWith('.txt')) {
                text = await file.text();
            } else {
                setAlert({ type: 'error', message: 'Unsupported file format. Please upload .docx or .txt' });
                return;
            }

            const parsedQuestions = parseTextToQuestions(text);
            if (parsedQuestions.length > 0) {
                if (questions.length === 1 && questions[0].question_text === '') {
                    setQuestions(parsedQuestions.slice(0, 30));
                } else {
                    const combined = [...questions, ...parsedQuestions];
                    setQuestions(combined.slice(0, 30));
                }
                setAlert({ type: 'success', message: `Successfully extracted ${parsedQuestions.length} questions.` });
            } else {
                setAlert({ type: 'error', message: 'Could not find any standard structure questions. Format must be 1. Q, A) opt, B) opt, Answer: A' });
            }
        } catch (err) {
            console.error("Parse Error:", err);
            setAlert({ type: 'error', message: 'Error processing document.' });
        }
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            setAlert({ type: 'error', message: 'Test title is required.' });
            return;
        }

        setSubmitting(true);
        setAlert(null);

        try {
            const endpoint = testType === 'quiz'
                ? `${API_BASE_URL}/api/tests/quiz`
                : `${API_BASE_URL}/api/tests/code`;

            const payload_base = { title, description, duration_minutes: duration, pass_key: passKey, is_published: true, id: Date.now() };
            const body = testType === 'quiz'
                ? { ...payload_base, questions, test_type: 'quiz' }
                : { ...payload_base, problems, test_type: 'code' };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).catch(() => null);

            if (res && res.ok) {
                const data = await res.json();
                setAlert({ type: 'success', message: data.message });
            } else {
                setAlert({ type: 'error', message: 'Failed to publish test. Server error.' });
            }
            
            setTitle('');
            setDescription('');
            setDuration(60);
            setPassKey('');
            setQuestions([emptyQuizQuestion()]);
            setProblems([emptyCodeProblem()]);
            
        } catch (err) {
            setAlert({ type: 'error', message: 'Failed to connect to server.' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-greeting">Create Test</h1>
                <p className="admin-greeting-sub">Build a new quiz or coding assessment for your students.</p>
            </div>

            {alert && (
                <div className={`admin-alert ${alert.type === 'success' ? 'admin-alert-success' : 'admin-alert-error'}`}>
                    {alert.message}
                </div>
            )}

            {/* Test Type Toggle */}
            <div className="admin-test-type-toggle">
                <button
                    className={`admin-test-type-btn ${testType === 'quiz' ? 'active' : ''}`}
                    onClick={() => setTestType('quiz')}
                >
                    Quiz Test
                </button>
                <button
                    className={`admin-test-type-btn ${testType === 'code' ? 'active' : ''}`}
                    onClick={() => setTestType('code')}
                >
                    Code Test
                </button>
            </div>

            {/* Test Meta */}
            <div className="admin-card" style={{ marginBottom: '24px' }}>
                <div className="admin-form-row">
                    <div className="admin-form-group">
                        <label className="admin-form-label">Test Title</label>
                        <input
                            className="admin-form-input"
                            placeholder="e.g. Data Structures Quiz - Week 3"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Duration (minutes)</label>
                        <input
                            type="number"
                            className="admin-form-input"
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                            min="1"
                        />
                    </div>
                </div>
                <div className="admin-form-row">
                    <div className="admin-form-group">
                        <label className="admin-form-label">Pass Key</label>
                        <input
                            type="text"
                            className="admin-form-input"
                            placeholder="Enter a pass key for students"
                            value={passKey}
                            onChange={(e) => setPassKey(e.target.value)}
                        />
                    </div>
                </div>
                <div className="admin-form-group full-width">
                    <label className="admin-form-label">Description</label>
                    <textarea
                        className="admin-form-textarea"
                        placeholder="Brief description of this test..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                    />
                </div>
            </div>

            {/* Quiz Questions */}
            {testType === 'quiz' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 className="admin-section-title" style={{ margin: 0 }}>Questions ({questions.length}/30)</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                             <input type="file" accept=".txt, .docx" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                             <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px' }}>
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                 Upload Data
                             </button>
                        </div>
                    </div>

                    <div 
                        className={`admin-upload-zone ${isDragging ? 'dragging' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        style={{
                            border: `2px dashed ${isDragging ? '#EAB308' : '#CBD5E1'}`,
                            borderRadius: '8px',
                            padding: '32px',
                            textAlign: 'center',
                            marginBottom: '24px',
                            backgroundColor: isDragging ? '#FEFCE8' : '#F8FAFC',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                        }}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isDragging ? '#EAB308' : '#94A3B8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <h4 style={{ margin: '0 0 4px', color: '#1E293B', fontSize: '14px', fontWeight: '500' }}>Drag & Drop to Upload Test Questions</h4>
                        <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>Supports .docx and .txt formats. Document format: 1. Q / A) B) C) D) / Ans: A</p>
                    </div>
                    {questions.map((q, qi) => (
                        <div key={qi} className="admin-question-block">
                            <div className="admin-question-header">
                                <span className="admin-question-number">Q{qi + 1}</span>
                                {questions.length > 1 && (
                                    <button className="admin-question-remove" onClick={() => removeQuestion(qi)}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                )}
                            </div>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Question</label>
                                <textarea
                                    className="admin-form-textarea"
                                    placeholder="Enter the question..."
                                    value={q.question_text}
                                    onChange={(e) => updateQuestion(qi, 'question_text', e.target.value)}
                                    rows={2}
                                    style={{ minHeight: '60px' }}
                                />
                            </div>
                            <div className="admin-options-grid">
                                {['A', 'B', 'C', 'D'].map((opt) => (
                                    <div key={opt} className="admin-option-row">
                                        <span className="admin-option-label">{opt}.</span>
                                        <input
                                            className="admin-option-input"
                                            placeholder={`Option ${opt}`}
                                            value={q[`option_${opt.toLowerCase()}`]}
                                            onChange={(e) => updateQuestion(qi, `option_${opt.toLowerCase()}`, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="admin-correct-select">
                                <label>Correct Answer</label>
                                <select
                                    value={q.correct_option}
                                    onChange={(e) => updateQuestion(qi, 'correct_option', e.target.value)}
                                >
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                    <option value="D">D</option>
                                </select>
                            </div>
                        </div>
                    ))}
                    {questions.length < 30 && (
                        <button className="admin-add-btn" onClick={addQuestion}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Add Question ({questions.length}/30)
                        </button>
                    )}
                </div>
            )}

            {/* Code Problems */}
            {testType === 'code' && (
                <div>
                    <h3 className="admin-section-title">Problems ({problems.length}/10)</h3>
                    <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '16px' }}>
                        Compiler integration will be configured separately. Define the problems and test cases below.
                    </p>
                    {problems.map((p, pi) => (
                        <div key={pi} className="admin-question-block">
                            <div className="admin-question-header">
                                <span className="admin-question-number">Problem {pi + 1}</span>
                                {problems.length > 1 && (
                                    <button className="admin-question-remove" onClick={() => removeProblem(pi)}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                )}
                            </div>
                            <div className="admin-form-row">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Problem Title</label>
                                    <input
                                        className="admin-form-input"
                                        placeholder="e.g. Two Sum"
                                        value={p.title}
                                        onChange={(e) => updateProblem(pi, 'title', e.target.value)}
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Marks</label>
                                    <input
                                        type="number"
                                        className="admin-form-input"
                                        value={p.marks}
                                        onChange={(e) => updateProblem(pi, 'marks', parseInt(e.target.value) || 10)}
                                    />
                                </div>
                            </div>
                            <div className="admin-form-group full-width" style={{ marginBottom: '12px' }}>
                                <label className="admin-form-label">Description</label>
                                <textarea
                                    className="admin-form-textarea"
                                    placeholder="Describe the problem..."
                                    value={p.description}
                                    onChange={(e) => updateProblem(pi, 'description', e.target.value)}
                                />
                            </div>
                            <div className="admin-form-row">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Input Format</label>
                                    <textarea className="admin-form-textarea" style={{ minHeight: '60px' }} placeholder="Describe input format..." value={p.input_format} onChange={(e) => updateProblem(pi, 'input_format', e.target.value)} />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Output Format</label>
                                    <textarea className="admin-form-textarea" style={{ minHeight: '60px' }} placeholder="Describe output format..." value={p.output_format} onChange={(e) => updateProblem(pi, 'output_format', e.target.value)} />
                                </div>
                            </div>
                            <div className="admin-form-row">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Constraints</label>
                                    <textarea className="admin-form-textarea" style={{ minHeight: '50px' }} placeholder="e.g. 1 <= n <= 10^5" value={p.constraints_text} onChange={(e) => updateProblem(pi, 'constraints_text', e.target.value)} />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Sample Input</label>
                                    <textarea className="admin-form-textarea" style={{ minHeight: '50px', fontFamily: 'monospace' }} placeholder="5&#10;1 2 3 4 5" value={p.sample_input} onChange={(e) => updateProblem(pi, 'sample_input', e.target.value)} />
                                </div>
                            </div>
                            <div className="admin-form-group" style={{ marginBottom: '16px' }}>
                                <label className="admin-form-label">Sample Output</label>
                                <textarea className="admin-form-textarea" style={{ minHeight: '50px', fontFamily: 'monospace' }} placeholder="15" value={p.sample_output} onChange={(e) => updateProblem(pi, 'sample_output', e.target.value)} />
                            </div>

                            {/* Test Cases */}
                            <div className="admin-testcase-block">
                                <div className="admin-testcase-header">
                                    <span className="admin-form-label" style={{ margin: 0 }}>Test Cases ({p.test_cases.length})</span>
                                    <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => addTestCase(pi)}>
                                        + Add Test Case
                                    </button>
                                </div>
                                {p.test_cases.map((tc: any, tci: number) => (
                                    <div key={tci} className="admin-testcase-row">
                                        <div className="admin-form-group">
                                            <label className="admin-form-label" style={{ fontSize: '11px' }}>Input</label>
                                            <textarea className="admin-form-textarea" style={{ minHeight: '40px', fontFamily: 'monospace', fontSize: '13px' }} value={tc.input} onChange={(e) => updateTestCase(pi, tci, 'input', e.target.value)} />
                                        </div>
                                        <div className="admin-form-group">
                                            <label className="admin-form-label" style={{ fontSize: '11px' }}>Expected Output</label>
                                            <textarea className="admin-form-textarea" style={{ minHeight: '40px', fontFamily: 'monospace', fontSize: '13px' }} value={tc.expected_output} onChange={(e) => updateTestCase(pi, tci, 'expected_output', e.target.value)} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '20px' }}>
                                            <label className="admin-testcase-hidden-toggle">
                                                <input type="checkbox" checked={tc.is_hidden} onChange={(e) => updateTestCase(pi, tci, 'is_hidden', e.target.checked)} />
                                                Hidden
                                            </label>
                                            {p.test_cases.length > 1 && (
                                                <button className="admin-question-remove" onClick={() => removeTestCase(pi, tci)} style={{ marginTop: '4px' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {problems.length < 10 && (
                        <button className="admin-add-btn" onClick={addProblem}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Add Problem ({problems.length}/10)
                        </button>
                    )}
                </div>
            )}

            {/* Submit */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', marginBottom: '40px' }}>
                <button
                    className="admin-btn admin-btn-primary"
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{ padding: '12px 32px', fontSize: '15px' }}
                >
                    {submitting ? 'Publishing...' : 'Publish Test'}
                </button>
            </div>
        </div>
    );
};

export default CreateTest;
