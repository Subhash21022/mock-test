import { API_BASE_URL } from '../../config';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAntiCheat } from './useAntiCheat';
import './student.css';

const API_BASE = API_BASE_URL;

// ── Types ──
interface TestCase {
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

interface Problem {
  problem_number: number;
  title: string;
  description: string;
  input_format?: string;
  output_format?: string;
  constraints_text?: string;
  sample_input?: string;
  sample_output?: string;
  marks: number;
  test_cases: TestCase[];
}

interface TestData {
  id: number;
  title: string;
  description: string;
  test_type: string;
  duration_minutes: number;
  problems?: Problem[];
  questions?: any[];
}

interface TestCaseResult {
  test_case: number;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  is_hidden: boolean;
  error: string | null;
}

interface RunResult {
  results: TestCaseResult[];
  all_passed: boolean;
  passed_count: number;
  total_count: number;
  problem_title: string;
  marks: number;
}

// ── Utility: format time ──
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ── Main Component ──
const TestRunner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Core state
  const [test, setTest] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [warningMessage, setWarningMessage] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  
  // Quiz Submission state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotalMarks, setQuizTotalMarks] = useState(0);
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);

  // Code editor state
  const [code, setCode] = useState('');
  const codeRef = useRef<HTMLTextAreaElement>(null);

  // Compiler state
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResults, setRunResults] = useState<RunResult | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string>('');
  const [consoleStatus, setConsoleStatus] = useState<'idle' | 'running' | 'passed' | 'failed' | 'error'>('idle');
  const [canSubmit, setCanSubmit] = useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'testcases' | 'output'>('testcases');

  // Timer state
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track which problems have all test cases passed
  const [problemPassStatus, setProblemPassStatus] = useState<Record<number, boolean>>({});

  // Accumulate scores for code tests
  const problemScoresRef = useRef<Record<number, number>>({});

  // Anti-Cheat
  const { enterFullscreen, disable: disableAntiCheat } = useAntiCheat({
    maxTabSwitches: 2,
    maxFullscreenEscapes: 2,
    onWarning: (reason: string, warningsLeft: number) => {
      setWarningMessage(`WARNING: ${reason} (Remaining warnings: ${warningsLeft})`);
      if (!reason.includes('full-screen')) {
        setTimeout(() => setWarningMessage(''), 5000);
      }
    },
    onTerminate: async (reason: string) => {
      alert(`TEST TERMINATED: ${reason}`);
      await handleFinalSubmit(true);
    }
  });

  // ── Fetch test data ──
  useEffect(() => {
    fetchTest();
    enterFullscreen();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  // ── Timer countdown ──
  useEffect(() => {
    if (timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          alert('⏰ Time is up! Auto-submitting your assessment.');
          if (test?.test_type === 'quiz') {
             handleFinalSubmit(true);
          } else {
             handleFinalSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft > 0]);

  // ── Set default code when problem changes ──
  useEffect(() => {
    if (test?.test_type === 'code' && test.problems) {
      const p = test.problems[currentProblemIndex];
      if (p) {
        setCode(getDefaultCode(p));
        setRunResults(null);
        setConsoleOutput('');
        setConsoleStatus('idle');
        setCanSubmit(problemPassStatus[currentProblemIndex] || false);
        setActiveConsoleTab('testcases');
      }
    }
  }, [currentProblemIndex, test]);

  const fetchTest = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (!user) { navigate('/login'); return; }

      // Check if already attempted
      const resultRes = await fetch(`${API_BASE}/api/results?student_id=${user._id}&test_id=${id}`);
      if (resultRes.ok) {
          const results = await resultRes.json();
          if (results.length > 0 && results.some((r: any) => r.status === 'completed' || r.status === 'terminated')) {
              alert("You have already completed this assessment.");
              if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); }
              navigate('/student');
              return;
          }
      }

      const response = await fetch(`${API_BASE}/api/tests/${id}?student_id=${user._id}`).catch(() => null);
      if (response && response.ok) {
        const data = await response.json();
        setTest(data);
        setTimeLeft((data.duration_minutes || 60) * 60);
        // Set initial code
        if (data.test_type === 'code' && data.problems?.length > 0) {
          setCode(getDefaultCode(data.problems[0]));
        }
      } else {
        alert("Test not found");
        navigate('/student');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  function getDefaultCode(problem: Problem): string {
    // Generate a boilerplate based on the problem
    const hasInput = problem.input_format && problem.input_format.toLowerCase() !== 'none' && problem.input_format.trim() !== '';
    
    if (hasInput) {
      return `// Problem: ${problem.title}
// Read input from stdin and write output to stdout

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

let lines = [];
rl.on('line', (line) => {
    lines.push(line.trim());
});

rl.on('close', () => {
    // Your solution here
    // Example: console.log(lines[0]);
    
});
`;
    }
    
    return `// Problem: ${problem.title}
// Write your JavaScript solution here

function solution() {
    // TODO: Implement your solution
    
}

solution();
`;
  }

  // ── RUN CODE - Execute against test cases ──
  const handleRun = useCallback(async () => {
    if (isRunning || !test) return;

    setIsRunning(true);
    setConsoleStatus('running');
    setConsoleOutput('⏳ Compiling and running against test cases...\n');
    setRunResults(null);
    setActiveConsoleTab('testcases');

    try {
      const response = await fetch(`${API_BASE}/api/compile/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          testId: test.id,
          problemIndex: currentProblemIndex
        })
      });

      const data: RunResult = await response.json();

      if (response.ok) {
        setRunResults(data);

        if (data.all_passed) {
          setConsoleStatus('passed');
          setConsoleOutput(`✅ All ${data.total_count} test case(s) passed!\n`);
          setCanSubmit(true);
          setProblemPassStatus(prev => ({ ...prev, [currentProblemIndex]: true }));
        } else {
          setConsoleStatus('failed');
          const failedCases = data.results.filter(r => !r.passed);
          let output = `❌ ${data.passed_count}/${data.total_count} test case(s) passed.\n\n`;
          failedCases.forEach(fc => {
            if (fc.error) {
              output += `🔴 Test Case ${fc.test_case}: RUNTIME ERROR\n`;
              output += `   Error: ${fc.error}\n\n`;
            } else {
              output += `🔴 Test Case ${fc.test_case}: WRONG ANSWER\n`;
              if (!fc.is_hidden) {
                output += `   Input:    ${fc.input}\n`;
                output += `   Expected: ${fc.expected}\n`;
                output += `   Got:      ${fc.actual}\n\n`;
              } else {
                output += `   (Hidden test case)\n\n`;
              }
            }
          });
          setConsoleOutput(output);
          setCanSubmit(false);
          setProblemPassStatus(prev => ({ ...prev, [currentProblemIndex]: false }));
        }
      } else {
        setConsoleStatus('error');
        setConsoleOutput(`🔴 Error: ${(data as any).error || 'Unknown error occurred'}\n`);
        setCanSubmit(false);
      }
    } catch (err: any) {
      setConsoleStatus('error');
      setConsoleOutput(`🔴 Network Error: Could not connect to compiler service.\n${err.message}\n`);
      setCanSubmit(false);
    } finally {
      setIsRunning(false);
    }
  }, [code, test, currentProblemIndex, isRunning]);

  // ── SUBMIT - Final submission ──
  const handleSubmit = useCallback(async () => {
    if (isSubmitting || !canSubmit || !test) return;

    const confirmed = window.confirm(
      '🚀 Submit your solution?\n\nThis will be your final submission for this problem. Make sure all test cases pass.'
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setConsoleOutput('📤 Submitting solution...\n');

    try {
      const storedUser = localStorage.getItem('user');
      const user = storedUser ? JSON.parse(storedUser) : null;

      const response = await fetch(`${API_BASE}/api/compile/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          testId: test.id,
          problemIndex: currentProblemIndex,
          studentId: user?._id || 0
        })
      });

      const data = await response.json();

      if (response.ok) {
        problemScoresRef.current[currentProblemIndex] = data.score;
        setConsoleOutput(`✅ ${data.message}\nScore: ${data.score}/${data.total_marks}`);
        
        // If single problem test, call final submit directly
        if (test.problems && test.problems.length <= 1) {
          setTimeout(() => {
            handleFinalSubmit(false);
          }, 1500);
        } else {
          alert(`Problem submitted! Score: ${data.score}/${data.total_marks}`);
        }
      } else {
        setConsoleOutput(`❌ Submission failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setConsoleOutput(`🔴 Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [code, test, currentProblemIndex, canSubmit, isSubmitting, navigate]);

  // ── Force submit (for anti-cheat / time-up) ──
  const handleFinalSubmit = async (force: boolean = false) => {
    disableAntiCheat();
    try {
      const storedUser = localStorage.getItem('user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      if (!user || !test) return;

      let score = 0;
      let total_marks = 10;

      if (test.test_type === 'quiz' && test.questions) {
          total_marks = test.questions.reduce((sum, q: any) => sum + Number(q.marks || 1), 0);
          score = test.questions.reduce((sum, q: any) => {
              const selected = quizAnswers[q.id || q.question_number];
              if (selected && selected.toLowerCase() === q.correct_option?.toLowerCase()) {
                  return sum + Number(q.marks || 1);
              }
              return sum;
          }, 0);
          setQuizScore(score);
          setQuizTotalMarks(total_marks);
      } else if (test.test_type === 'code' && test.problems) {
          total_marks = test.problems.reduce((sum, p) => sum + Number(p.marks || 10), 0) || 10;
          score = test.problems.reduce((sum, _p, index) => sum + Number(problemScoresRef.current[index] || 0), 0);
      }

      await fetch(`${API_BASE}/api/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_id: parseInt(id || '0'),
          student_id: user._id,
          score: score,
          total_marks: total_marks,
          status: force ? 'terminated' : 'completed'
        })
      }).catch(() => null);

      if (test.test_type === 'quiz') {
         setQuizSubmitted(true);
         setShowConfirmModal(false);
         if (!force) {
            alert('Your submission was successfull.');
         }
      } else {
         if (document.fullscreenElement) {
           document.exitFullscreen().catch(() => {});
         }
         navigate('/student');
      }
    } catch (err) {
      console.error("Submit error", err);
      if (test?.test_type !== 'quiz') {
        navigate('/student');
      }
    }
  };

  const handleQuizConfirmSubmit = () => {
      if (confirmInput !== 'SUBMIT') {
          alert('Please type SUBMIT to confirm.');
          return;
      }
      handleFinalSubmit(false);
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter = Run
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
      // Ctrl+Shift+Enter = Submit
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if (canSubmit) handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun, handleSubmit, canSubmit]);

  // ── Handle Tab key in textarea ──
  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{ 
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#e2e8f0', fontFamily: 'system-ui', flexDirection: 'column', gap: '16px'
      }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid #334155', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Loading secure environment...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ── Warning overlay ──
  const warningOverlay = warningMessage && (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#1e293b', padding: '40px', borderRadius: '12px', textAlign: 'center', maxWidth: '500px', border: '1px solid #334155' }}>
        <h2 style={{ color: '#ef4444', margin: '0 0 16px', fontSize: '28px', fontWeight: 'bold' }}>WARNING</h2>
        <p style={{ color: 'white', fontSize: '16px', lineHeight: '1.5', margin: '0 0 24px' }}>{warningMessage}</p>
        {warningMessage.includes('full-screen') && (
          <button
            className="btn-accent"
            style={{ backgroundColor: '#ef4444', border: 'none', width: '100%', padding: '12px' }}
            onClick={() => { enterFullscreen(); setWarningMessage(''); }}
          >Return to Full Screen</button>
        )}
      </div>
    </div>
  );

  // ====== CODE TEST LAYOUT ======
  if (test?.test_type === 'code') {
    const p = test.problems && test.problems.length > 0 ? test.problems[currentProblemIndex] : null;
    const testCases = p?.test_cases || [];
    const visibleTestCases = testCases.filter(tc => !tc.is_hidden);

    // Timer color
    const timerColor = timeLeft <= 60 ? '#ef4444' : timeLeft <= 300 ? '#f59e0b' : '#10b981';

    // Status dot color
    const statusDotColor = {
      'idle': '#64748b',
      'running': '#f59e0b',
      'passed': '#10b981',
      'failed': '#ef4444',
      'error': '#ef4444'
    }[consoleStatus];

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 50, display: 'flex', flexDirection: 'column',
        background: '#0f172a', color: '#e2e8f0',
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif'
      }}>
        {warningOverlay}

        {/* ─── TOP BAR ─── */}
        <div style={{
          height: '48px', minHeight: '48px',
          background: 'linear-gradient(180deg, #1e293b 0%, #162032 100%)',
          borderBottom: '1px solid #334155',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>
              {test.title}
            </span>
            <span style={{
              fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
              background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8',
              padding: '3px 8px', borderRadius: '4px', letterSpacing: '0.5px'
            }}>CODE</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Timer */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#0f172a', padding: '6px 14px', borderRadius: '8px',
              border: `1px solid ${timerColor}30`
            }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>⏱</span>
              <span style={{
                fontSize: '16px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                color: timerColor, fontFamily: '"JetBrains Mono", "Fira Code", monospace'
              }}>{formatTime(timeLeft)}</span>
            </div>

            {/* Exit */}
            <button
              onClick={() => {
                if (window.confirm('Are you sure? Your progress will be lost.')) {
                  handleFinalSubmit(true);
                }
              }}
              style={{
                padding: '6px 14px', background: 'transparent', color: '#f87171',
                border: '1px solid rgba(248, 113, 113, 0.3)', borderRadius: '6px',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: '0.2s'
              }}
            >Exit</button>
          </div>
        </div>

        {/* ─── MAIN CONTENT ─── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ═══ LEFT PANEL - Problem Description (38%) ═══ */}
          <div style={{
            width: '38%', minWidth: '340px',
            borderRight: '2px solid #1e293b',
            display: 'flex', flexDirection: 'column', background: '#0f172a'
          }}>
            {/* Problem tabs */}
            <div style={{
              padding: '10px 20px', background: '#1e293b',
              borderBottom: '1px solid #334155',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{
                background: '#38bdf8', color: '#0f172a',
                width: '24px', height: '24px', borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 800
              }}>{currentProblemIndex + 1}</span>
              <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '14px' }}>
                {p?.title || 'Problem'}
              </span>
              <div style={{ flex: 1 }} />
              <span style={{
                fontSize: '11px', fontWeight: 600,
                background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e',
                padding: '3px 8px', borderRadius: '4px'
              }}>
                {p?.marks || 10} pts
              </span>
            </div>

            {/* Problem body - scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {p ? (
                <>
                  {/* Description */}
                  <p style={{
                    color: '#cbd5e1', lineHeight: '1.7', whiteSpace: 'pre-wrap',
                    fontSize: '14px', marginTop: 0, marginBottom: '24px'
                  }}>{p.description}</p>

                  {/* Input Format */}
                  {p.input_format && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{
                        color: '#f8fafc', margin: '0 0 8px', fontSize: '13px',
                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'
                      }}>Input Format</h4>
                      <div style={{
                        background: '#1e293b', padding: '12px 16px', borderRadius: '8px',
                        color: '#cbd5e1', fontSize: '13px', lineHeight: '1.5',
                        border: '1px solid #334155', whiteSpace: 'pre-wrap'
                      }}>{p.input_format}</div>
                    </div>
                  )}

                  {/* Output Format */}
                  {p.output_format && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{
                        color: '#f8fafc', margin: '0 0 8px', fontSize: '13px',
                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'
                      }}>Output Format</h4>
                      <div style={{
                        background: '#1e293b', padding: '12px 16px', borderRadius: '8px',
                        color: '#cbd5e1', fontSize: '13px', lineHeight: '1.5',
                        border: '1px solid #334155', whiteSpace: 'pre-wrap'
                      }}>{p.output_format}</div>
                    </div>
                  )}

                  {/* Constraints */}
                  {p.constraints_text && p.constraints_text.toLowerCase() !== 'none' && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{
                        color: '#f8fafc', margin: '0 0 8px', fontSize: '13px',
                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px'
                      }}>Constraints</h4>
                      <div style={{
                        background: '#1e293b', padding: '12px 16px', borderRadius: '8px',
                        color: '#fbbf24', fontSize: '13px', lineHeight: '1.5',
                        border: '1px solid #334155', whiteSpace: 'pre-wrap'
                      }}>{p.constraints_text}</div>
                    </div>
                  )}

                  {/* Sample I/O */}
                  <div style={{
                    background: '#1e293b', borderRadius: '8px',
                    border: '1px solid #334155', overflow: 'hidden', marginBottom: '20px'
                  }}>
                    <div style={{
                      padding: '8px 16px', background: '#162032',
                      borderBottom: '1px solid #334155',
                      fontSize: '12px', fontWeight: 700, color: '#94a3b8',
                      textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>Example</div>
                    {p.sample_input !== undefined && p.sample_input !== '' && (
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid #293548' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>Input</div>
                        <pre style={{ margin: 0, color: '#e2e8f0', fontSize: '13px', fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>{p.sample_input || '(no input)'}</pre>
                      </div>
                    )}
                    {p.sample_output && (
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>Output</div>
                        <pre style={{ margin: 0, color: '#10b981', fontSize: '13px', fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}>{p.sample_output}</pre>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p style={{ color: '#94a3b8' }}>No problem found.</p>
              )}
            </div>

            {/* Problem navigation */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #334155', background: '#1e293b',
              display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={currentProblemIndex === 0}
                  onClick={() => setCurrentProblemIndex(i => i - 1)}
                  style={{
                    padding: '6px 14px',
                    background: currentProblemIndex === 0 ? '#0f172a' : '#334155',
                    color: currentProblemIndex === 0 ? '#475569' : 'white',
                    border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    cursor: currentProblemIndex === 0 ? 'not-allowed' : 'pointer',
                    transition: '0.2s'
                  }}
                >← Prev</button>
                <button
                  disabled={currentProblemIndex === (test.problems?.length || 1) - 1}
                  onClick={() => setCurrentProblemIndex(i => i + 1)}
                  style={{
                    padding: '6px 14px',
                    background: currentProblemIndex === (test.problems?.length || 1) - 1 ? '#0f172a' : '#334155',
                    color: currentProblemIndex === (test.problems?.length || 1) - 1 ? '#475569' : 'white',
                    border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                    cursor: currentProblemIndex === (test.problems?.length || 1) - 1 ? 'not-allowed' : 'pointer',
                    transition: '0.2s'
                  }}
                >Next →</button>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {test.problems?.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentProblemIndex(i)}
                    style={{
                      width: '28px', height: '28px', borderRadius: '6px',
                      border: i === currentProblemIndex ? '2px solid #38bdf8' : '1px solid #334155',
                      background: problemPassStatus[i] ? 'rgba(16, 185, 129, 0.2)' : (i === currentProblemIndex ? '#0f172a' : 'transparent'),
                      color: problemPassStatus[i] ? '#10b981' : (i === currentProblemIndex ? '#38bdf8' : '#94a3b8'),
                      cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >{problemPassStatus[i] ? '✓' : i + 1}</button>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT PANEL - Editor + Console (62%) ═══ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* ─── CODE EDITOR (top 60%) ─── */}
            <div style={{ flex: 6, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Editor header */}
              <div style={{
                padding: '8px 16px', background: '#1e293b',
                borderBottom: '1px solid #334155',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    color: '#38bdf8', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace',
                    fontWeight: 600, background: '#0f172a', padding: '5px 10px',
                    borderRadius: '4px', border: '1px solid #334155',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span style={{ color: '#fbbf24' }}>JS</span> solution.js
                  </div>
                  <span style={{ color: '#475569', fontSize: '11px' }}>
                    Ctrl+Enter to Run | Ctrl+Shift+Enter to Submit
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* RUN BUTTON */}
                  <button
                    id="run-code-btn"
                    onClick={handleRun}
                    disabled={isRunning || isSubmitting}
                    style={{
                      padding: '7px 20px',
                      background: isRunning ? '#1e293b' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: isRunning ? '#94a3b8' : 'white',
                      border: isRunning ? '1px solid #334155' : 'none',
                      borderRadius: '6px', cursor: isRunning ? 'not-allowed' : 'pointer',
                      fontSize: '13px', fontWeight: 700, transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      boxShadow: isRunning ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    {isRunning ? (
                      <>
                        <span style={{
                          width: '14px', height: '14px',
                          border: '2px solid #475569', borderTopColor: '#94a3b8',
                          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                          display: 'inline-block'
                        }} />
                        Running...
                      </>
                    ) : (
                      <>▶ Run</>
                    )}
                  </button>

                  {/* SUBMIT BUTTON */}
                  <button
                    id="submit-code-btn"
                    onClick={handleSubmit}
                    disabled={!canSubmit || isSubmitting || isRunning}
                    style={{
                      padding: '7px 20px',
                      background: canSubmit
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        : '#1e293b',
                      color: canSubmit ? 'white' : '#475569',
                      border: canSubmit ? 'none' : '1px solid #334155',
                      borderRadius: '6px',
                      cursor: canSubmit && !isSubmitting ? 'pointer' : 'not-allowed',
                      fontSize: '13px', fontWeight: 700, transition: 'all 0.3s',
                      display: 'flex', alignItems: 'center', gap: '6px',
                      boxShadow: canSubmit ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
                      opacity: canSubmit ? 1 : 0.5
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <span style={{
                          width: '14px', height: '14px',
                          border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                          display: 'inline-block'
                        }} />
                        Submitting...
                      </>
                    ) : (
                      <>🚀 Submit</>
                    )}
                  </button>
                </div>
              </div>

              {/* Code textarea */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {/* Line numbers gutter */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: '48px',
                  background: '#0a0f1c', borderRight: '1px solid #1e293b',
                  overflowY: 'hidden', userSelect: 'none', zIndex: 2
                }}>
                  <div style={{
                    padding: '20px 0', fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: '14px', lineHeight: '1.6', color: '#334155', textAlign: 'right',
                    paddingRight: '12px'
                  }}>
                    {code.split('\n').map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                </div>

                <textarea
                  ref={codeRef}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setCanSubmit(false); // Reset submit state when code changes
                    setProblemPassStatus(prev => ({ ...prev, [currentProblemIndex]: false }));
                  }}
                  onKeyDown={handleCodeKeyDown}
                  spellCheck={false}
                  style={{
                    width: '100%', height: '100%', boxSizing: 'border-box',
                    padding: '20px 20px 20px 56px',
                    background: '#0f172a', color: '#e2e8f0', border: 'none', outline: 'none',
                    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
                    fontSize: '14px', resize: 'none', lineHeight: '1.6',
                    caretColor: '#38bdf8', tabSize: 4
                  }}
                />
              </div>
            </div>

            {/* ─── CONSOLE PANEL (bottom 40%) ─── */}
            <div style={{
              flex: 4, display: 'flex', flexDirection: 'column',
              borderTop: '2px solid #1e293b', background: '#0c1222', minHeight: 0
            }}>
              {/* Console tabs */}
              <div style={{
                padding: '0 16px', background: '#1e293b',
                borderBottom: '1px solid #334155',
                display: 'flex', alignItems: 'stretch', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', gap: '0' }}>
                  <button
                    onClick={() => setActiveConsoleTab('testcases')}
                    style={{
                      padding: '10px 16px', background: 'transparent',
                      color: activeConsoleTab === 'testcases' ? '#f8fafc' : '#64748b',
                      border: 'none', borderBottom: activeConsoleTab === 'testcases' ? '2px solid #38bdf8' : '2px solid transparent',
                      cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: '8px',
                      textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}
                  >
                    Test Cases
                    {runResults && (
                      <span style={{
                        background: runResults.all_passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: runResults.all_passed ? '#10b981' : '#ef4444',
                        padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700
                      }}>
                        {runResults.passed_count}/{runResults.total_count}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveConsoleTab('output')}
                    style={{
                      padding: '10px 16px', background: 'transparent',
                      color: activeConsoleTab === 'output' ? '#f8fafc' : '#64748b',
                      border: 'none', borderBottom: activeConsoleTab === 'output' ? '2px solid #38bdf8' : '2px solid transparent',
                      cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                  >
                    Console
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: statusDotColor,
                      boxShadow: consoleStatus === 'running' ? `0 0 8px ${statusDotColor}` : 'none',
                      animation: consoleStatus === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none'
                    }} />
                  </button>
                </div>

                {/* Status badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {consoleStatus !== 'idle' && (
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 10px',
                      borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px',
                      background: {
                        'running': 'rgba(245, 158, 11, 0.15)',
                        'passed': 'rgba(16, 185, 129, 0.15)',
                        'failed': 'rgba(239, 68, 68, 0.15)',
                        'error': 'rgba(239, 68, 68, 0.15)',
                        'idle': 'transparent'
                      }[consoleStatus],
                      color: {
                        'running': '#f59e0b',
                        'passed': '#10b981',
                        'failed': '#ef4444',
                        'error': '#ef4444',
                        'idle': '#64748b'
                      }[consoleStatus]
                    }}>
                      {consoleStatus === 'running' ? '⏳ Running' : 
                       consoleStatus === 'passed' ? '✅ Accepted' :
                       consoleStatus === 'failed' ? '❌ Wrong Answer' :
                       consoleStatus === 'error' ? '🔴 Error' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Console body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                {activeConsoleTab === 'testcases' ? (
                  /* ── Test Cases Tab ── */
                  <div style={{ padding: '16px' }}>
                    {runResults ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {runResults.results.map((r, i) => (
                          <div key={i} style={{
                            background: r.passed ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
                            border: `1px solid ${r.passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                            borderRadius: '8px', padding: '12px 16px',
                            transition: 'all 0.2s'
                          }}>
                            <div style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              marginBottom: r.is_hidden ? 0 : '8px'
                            }}>
                              <span style={{
                                fontSize: '13px', fontWeight: 700,
                                color: r.passed ? '#10b981' : '#ef4444',
                                display: 'flex', alignItems: 'center', gap: '8px'
                              }}>
                                <span style={{
                                  width: '20px', height: '20px', borderRadius: '50%',
                                  background: r.passed ? '#10b981' : '#ef4444',
                                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '11px', fontWeight: 800
                                }}>
                                  {r.passed ? '✓' : '✗'}
                                </span>
                                Test Case {r.test_case}
                              </span>
                              <span style={{
                                fontSize: '11px', fontWeight: 700,
                                color: r.passed ? '#10b981' : '#ef4444',
                                textTransform: 'uppercase'
                              }}>
                                {r.passed ? 'PASSED' : (r.error ? 'ERROR' : 'FAILED')}
                              </span>
                            </div>

                            {!r.is_hidden && !r.passed && (
                              <div style={{
                                fontFamily: '"JetBrains Mono", monospace', fontSize: '12px',
                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px'
                              }}>
                                {r.input && r.input !== '(no input)' && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>Input</div>
                                    <div style={{ background: '#0f172a', padding: '8px 12px', borderRadius: '4px', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>{r.input}</div>
                                  </div>
                                )}
                                <div>
                                  <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>Expected</div>
                                  <div style={{ background: '#0f172a', padding: '8px 12px', borderRadius: '4px', color: '#10b981', whiteSpace: 'pre-wrap' }}>{r.expected}</div>
                                </div>
                                <div>
                                  <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>
                                    {r.error ? 'Error' : 'Your Output'}
                                  </div>
                                  <div style={{
                                    background: '#0f172a', padding: '8px 12px', borderRadius: '4px',
                                    color: r.error ? '#ef4444' : '#ef4444', whiteSpace: 'pre-wrap'
                                  }}>{r.error || r.actual || '(empty)'}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Default state - show visible test cases */
                      <div>
                        <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '12px', fontWeight: 600 }}>
                          {visibleTestCases.length > 0 ? `${visibleTestCases.length} visible test case(s)` : 'Sample test case'}
                          {testCases.filter(tc => tc.is_hidden).length > 0 && (
                            <span style={{ color: '#475569' }}> • {testCases.filter(tc => tc.is_hidden).length} hidden</span>
                          )}
                        </div>
                        {(visibleTestCases.length > 0 ? visibleTestCases : (p?.sample_output ? [{
                          input: p.sample_input || '',
                          expected_output: p.sample_output,
                          is_hidden: false
                        }] : [])).map((tc, i) => (
                          <div key={i} style={{
                            background: '#1e293b', border: '1px solid #334155',
                            borderRadius: '8px', padding: '12px 16px', marginBottom: '8px'
                          }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>
                              Test Case {i + 1}
                            </div>
                            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', display: 'flex', gap: '16px' }}>
                              {tc.input && (
                                <div style={{ flex: 1 }}>
                                  <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>Input</div>
                                  <div style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{tc.input || '(none)'}</div>
                                </div>
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>Expected Output</div>
                                <div style={{ color: '#10b981', whiteSpace: 'pre-wrap' }}>{tc.expected_output}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div style={{
                          marginTop: '12px', padding: '10px 14px',
                          background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.15)',
                          borderRadius: '6px', color: '#38bdf8', fontSize: '12px',
                          display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                          <span>💡</span> Click <strong>▶ Run</strong> to execute your code against all test cases
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Console Output Tab ── */
                  <div style={{
                    padding: '16px', fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '13px', color: '#cbd5e1', whiteSpace: 'pre-wrap',
                    lineHeight: '1.6'
                  }}>
                    {consoleOutput || (
                      <span style={{ color: '#475569' }}>
                        $ environment connected. awaiting execution...{'\n'}
                        <span style={{ color: '#38bdf8' }}>Info:</span> Click Run to execute your code.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Animations ── */}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg) } }
          @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
          textarea::selection { background: rgba(56, 189, 248, 0.3) }
          textarea::-webkit-scrollbar { width: 8px }
          textarea::-webkit-scrollbar-track { background: #0f172a }
          textarea::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px }
          textarea::-webkit-scrollbar-thumb:hover { background: #475569 }
          div::-webkit-scrollbar { width: 6px }
          div::-webkit-scrollbar-track { background: transparent }
          div::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px }
        `}</style>
      </div>
    );
  }

  // ====== QUIZ TEST LAYOUT ======
  return (
    <div style={{ background: 'var(--student-bg)', minHeight: '100vh', color: 'var(--student-text)', margin: '-32px', display: 'flex', flexDirection: 'column', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, overflow: 'auto' }}>
      {warningOverlay}

      <header className="runner-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '13px', color: 'var(--student-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{test?.test_type?.toUpperCase()}</h2>
          <h1 style={{ margin: '4px 0 0', fontSize: '20px', color: 'var(--student-text)', fontWeight: 700, letterSpacing: '-0.5px' }}>{test?.title}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#ffffff', padding: '6px 14px', borderRadius: '8px',
            border: `1px solid ${timeLeft <= 60 ? '#ef4444' : '#e2e8f0'}`
          }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>⏱</span>
            <span style={{
              fontSize: '18px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              color: timeLeft <= 60 ? '#ef4444' : '#0f172a', fontFamily: '"JetBrains Mono", "Fira Code", monospace'
            }}>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </header>

      <main style={{ padding: '32px', flex: 1, maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {quizSubmitted && (
            <div style={{ marginBottom: '24px', background: 'rgba(16, 185, 129, 0.1)', padding: '24px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
                <h2 style={{ color: '#10b981', margin: '0 0 8px' }}>Test Completed</h2>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Your Score: {quizScore} / {quizTotalMarks}</p>
            </div>
        )}

        {test?.questions?.length && test.questions.length > 0 ? (
          (() => {
            const q = test.questions[currentQuizQuestionIndex];
            if (!q) return null;
            return (
              <div key={q.id || q.question_number} style={{ marginBottom: '24px', background: 'var(--student-card-bg)', border: '1px solid var(--student-border)', padding: '32px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                   <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#38bdf8', textTransform: 'uppercase' }}>
                     Question {currentQuizQuestionIndex + 1} of {test.questions.length}
                   </span>
                   <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                     {Object.keys(quizAnswers).length} / {test.questions.length} Answered
                   </span>
                </div>
                <h3 style={{ marginTop: 0, fontSize: '18px' }}>
                  {q.question_text}
                </h3>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {['a', 'b', 'c', 'd'].map(opt => {
                    const isSelected = quizAnswers[q.id || q.question_number] === opt;
                    const isCorrectAns = q.correct_option?.toLowerCase() === opt;
                    
                    let optBg = 'var(--student-bg)';
                    let optBorder = 'var(--student-border)';
                    let optColor = 'var(--student-text)';

                    if (quizSubmitted) {
                       if (isCorrectAns) {
                           optBg = 'rgba(16, 185, 129, 0.15)';
                           optBorder = '#10b981';
                       } else if (isSelected && !isCorrectAns) {
                           optBg = 'rgba(239, 68, 68, 0.15)';
                           optBorder = '#ef4444';
                       } else {
                           optColor = 'var(--student-text-muted)';
                       }
                    } else if (isSelected) {
                       optBg = 'rgba(56, 189, 248, 0.1)';
                       optBorder = '#38bdf8';
                    }

                    return (
                      <label key={opt} style={{ 
                          display: 'flex', alignItems: 'center', gap: '8px', 
                          cursor: quizSubmitted ? 'default' : 'pointer', 
                          background: optBg, padding: '12px', borderRadius: '6px', border: `1px solid ${optBorder}`,
                          color: optColor, transition: '0.2s'
                      }}>
                          <input 
                          type="radio" 
                          name={`question-${q.id || q.question_number}`} 
                          value={opt} 
                          checked={isSelected}
                          onChange={() => {
                              if (!quizSubmitted) {
                                  setQuizAnswers(prev => ({...prev, [q.id || q.question_number]: opt}))
                              }
                          }}
                          disabled={quizSubmitted}
                          />
                          <span>{q[`option_${opt}`]}</span>
                          {quizSubmitted && isCorrectAns && <span style={{ marginLeft: 'auto', color: '#10b981', fontWeight: 'bold' }}>✓ Correct</span>}
                          {quizSubmitted && isSelected && !isCorrectAns && <span style={{ marginLeft: 'auto', color: '#ef4444', fontWeight: 'bold' }}>✗ Incorrect</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })()
        ) : (
          <div style={{ marginTop: '24px', background: 'var(--student-card-bg)', border: '1px solid var(--student-border)', padding: '32px', borderRadius: '10px', textAlign: 'center' }}>
            <p style={{ color: 'var(--student-text-muted)', fontSize: '15px' }}>No questions available for this test.</p>
          </div>
        )}
      </main>

      <footer style={{ padding: '16px 32px', background: 'var(--student-card-bg)', borderTop: '1px solid var(--student-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', bottom: 0, boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
         {!quizSubmitted && test?.questions && (
            <div style={{ display: 'flex', gap: '12px' }}>
               <button 
                  disabled={currentQuizQuestionIndex === 0} 
                  onClick={() => setCurrentQuizQuestionIndex(prev => prev - 1)}
                  style={{ padding: '8px 16px', borderRadius: '6px', cursor: currentQuizQuestionIndex === 0 ? 'not-allowed' : 'pointer', background: currentQuizQuestionIndex === 0 ? '#1e293b' : '#334155', color: currentQuizQuestionIndex === 0 ? '#64748b' : 'white', border: 'none', fontWeight: 'bold' }}
               >
                  ← Previous
               </button>
               <button 
                  disabled={currentQuizQuestionIndex === test.questions.length - 1} 
                  onClick={() => setCurrentQuizQuestionIndex(prev => prev + 1)}
                  style={{ padding: '8px 16px', borderRadius: '6px', cursor: currentQuizQuestionIndex === test.questions.length - 1 ? 'not-allowed' : 'pointer', background: currentQuizQuestionIndex === test.questions.length - 1 ? '#1e293b' : '#334155', color: currentQuizQuestionIndex === test.questions.length - 1 ? '#64748b' : 'white', border: 'none', fontWeight: 'bold' }}
               >
                  Next →
               </button>
            </div>
         )}
         
         <div style={{ display: 'flex', justifyContent: 'flex-end', flex: 1 }}>
           {!quizSubmitted ? (
               <button 
                  className="btn-accent" 
                  style={{ 
                     width: 'auto', 
                     backgroundColor: Object.keys(quizAnswers).length === (test?.questions?.length || 0) ? '#10b981' : '#0F172A', 
                     opacity: Object.keys(quizAnswers).length === (test?.questions?.length || 0) ? 1 : 0.5,
                     cursor: Object.keys(quizAnswers).length === (test?.questions?.length || 0) ? 'pointer' : 'not-allowed'
                  }} 
                  onClick={() => {
                     if (Object.keys(quizAnswers).length !== (test?.questions?.length || 0)) {
                         alert('Please answer all questions before submitting.');
                         return;
                     }
                     setShowConfirmModal(true);
                  }}
                  disabled={Object.keys(quizAnswers).length !== (test?.questions?.length || 0)}
               >
                  Submit Assessment
               </button>
           ) : (
               <button className="btn-accent" style={{ width: 'auto', backgroundColor: '#3b82f6' }} onClick={() => {
                   if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                   navigate('/student');
               }}>
                  Return to Dashboard
               </button>
           )}
         </div>
      </footer>

      {showConfirmModal && (
        <div style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 
        }}>
            <div style={{ background: 'var(--student-card-bg)', padding: '32px', borderRadius: '12px', width: '400px', border: '1px solid var(--student-border)' }}>
                <h2 style={{ marginTop: 0 }}>Confirm Submission</h2>
                <p style={{ color: 'var(--student-text-muted)' }}>Are you sure you want to submit the test? You will not be able to change your answers.</p>
                <div style={{ margin: '20px 0' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>Type SUBMIT to confirm</label>
                    <input 
                        type="text" 
                        value={confirmInput} 
                        onChange={(e) => setConfirmInput(e.target.value)} 
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQuizConfirmSubmit();
                        }}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--student-border)', background: 'var(--student-bg)', color: 'var(--student-text)', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={() => setShowConfirmModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--student-border)', color: 'var(--student-text)', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleQuizConfirmSubmit} style={{ padding: '8px 16px', background: '#3b82f6', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Confirm Submit</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TestRunner;
