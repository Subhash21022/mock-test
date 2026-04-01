import { API_BASE_URL } from '../../config';
import { useState, useEffect } from 'react';
import './admin.css';

const ManageTests = () => {
    const [existingTests, setExistingTests] = useState<any[]>([]);
    const [alert, setAlert] = useState<{type: string, message: string} | null>(null);

    const fetchTests = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/tests`);
            if (res.ok) {
                const data = await res.json();
                setExistingTests(data);
            }
        } catch (err) {
            console.error('Error fetching tests:', err);
        }
    };

    useEffect(() => {
        fetchTests();
    }, []);

    const handleDeleteTest = async (testId: number) => {
        if (!window.confirm('Are you sure you want to delete this test?')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/tests/${testId}`, { method: 'DELETE' });
            if (res.ok) {
                setAlert({ type: 'success', message: 'Test deleted successfully' });
                fetchTests();
            } else {
                setAlert({ type: 'error', message: 'Failed to delete test' });
            }
        } catch (err) {
            setAlert({ type: 'error', message: 'Error deleting test' });
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-greeting">Manage Quizzes</h1>
                <p className="admin-greeting-sub">Review and delete existing quizzes and code tests.</p>
            </div>

            {alert && (
                <div className={`admin-alert ${alert.type === 'success' ? 'admin-alert-success' : 'admin-alert-error'}`}>
                    {alert.message}
                </div>
            )}

            <div className="admin-table-container-new">
                <table className="admin-modern-table">
                    <thead>
                        <tr>
                            <th>Test ID</th>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Duration (mins)</th>
                            <th>Created Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {existingTests.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="admin-table-empty">No tests found.</td>
                            </tr>
                        ) : (
                            existingTests.map((test: any) => (
                                <tr key={test.id}>
                                    <td>{test.id}</td>
                                    <td>{test.title}</td>
                                    <td>{test.test_type === 'code' ? 'Code Test' : 'Quiz Test'}</td>
                                    <td>{test.duration_minutes} min</td>
                                    <td>{new Date(test.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <button 
                                            onClick={() => handleDeleteTest(test.id)}
                                            style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ManageTests;
