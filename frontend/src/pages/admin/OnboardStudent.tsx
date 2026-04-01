import { API_BASE_URL } from '../../config';
import { useState, useRef } from 'react';

const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'MECH', 'IT', 'AIDS', 'AIML'];
const SECTIONS = ['A', 'B', 'C'];

const OnboardStudent = () => {
    const [activeTab, setActiveTab] = useState('single');
    const [alert, setAlert] = useState<{type: string, message: string} | null>(null);

    // Single enrol state
    const [formData, setFormData] = useState({
        name: '', emailId: '', registrationNumber: '', rollNumber: '',
        department: 'CSE', classSection: 'A',
    });
    const [submitting, setSubmitting] = useState(false);

    // Bulk upload state
    const [bulkDepartment, setBulkDepartment] = useState('CSE');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFormChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSingleSubmit = async (e: any) => {
        e.preventDefault();
        if (!formData.name || !formData.emailId || !formData.registrationNumber) {
            setAlert({ type: 'error', message: 'Name, Email, and Register Number are required.' });
            return;
        }

        setSubmitting(true);
        setAlert(null);

        try {
            const res = await fetch(`${API_BASE_URL}/api/students`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();

            if (res.ok) {
                setAlert({ type: 'success', message: data.message });
                setFormData({ name: '', emailId: '', registrationNumber: '', rollNumber: '', department: 'CSE', classSection: 'A' });
            } else {
                setAlert({ type: 'error', message: data.message });
            }
        } catch (err) {
            setAlert({ type: 'error', message: 'Failed to connect to server.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/students/template`);
            if (!res.ok) throw new Error('Failed to download template');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'student_template.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setAlert({ type: 'error', message: 'Failed to download template.' });
        }
    };

    const handleFileSelect = (e: any) => {
        const file = e.target.files[0];
        if (file) setSelectedFile(file);
    };

    const handleDrop = (e: any) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) setSelectedFile(file);
    };

    const handleBulkUpload = async () => {
        if (!selectedFile) {
            setAlert({ type: 'error', message: 'Please select a CSV file.' });
            return;
        }

        setUploading(true);
        setAlert(null);

        try {
            const formDataObj = new FormData();
            formDataObj.append('file', selectedFile);
            formDataObj.append('department', bulkDepartment);

            const res = await fetch(`${API_BASE_URL}/api/students/bulk`, {
                method: 'POST',
                body: formDataObj,
            });
            const data = await res.json();

            if (res.ok) {
                setAlert({ type: 'success', message: data.message });
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
            } else {
                setAlert({ type: 'error', message: data.message });
            }
        } catch (err) {
            setAlert({ type: 'error', message: 'Failed to upload file.' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <div className="admin-page-header">
                <h1 className="admin-greeting">Onboard Student</h1>
                <p className="admin-greeting-sub">Enrol students individually or upload in bulk via CSV.</p>
            </div>

            {alert && (
                <div className={`admin-alert ${alert.type === 'success' ? 'admin-alert-success' : 'admin-alert-error'}`}>
                    {alert.message}
                </div>
            )}

            {/* Tabs */}
            <div className="admin-tabs">
                <button
                    className={`admin-tab ${activeTab === 'single' ? 'active' : ''}`}
                    onClick={() => setActiveTab('single')}
                >
                    Single Enrol
                </button>
                <button
                    className={`admin-tab ${activeTab === 'bulk' ? 'active' : ''}`}
                    onClick={() => setActiveTab('bulk')}
                >
                    Bulk Upload
                </button>
            </div>

            {/* Single Enrol */}
            {activeTab === 'single' && (
                <div className="admin-card">
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Single Student Enrolment
                    </h3>
                    <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '24px' }}>
                        Register number is used as the initial password.
                    </p>

                    <form onSubmit={handleSingleSubmit} className="admin-form">
                        <div className="admin-form-row">
                            <div className="admin-form-group">
                                <label className="admin-form-label">Full Name</label>
                                <input className="admin-form-input" name="name" placeholder="Student full name" value={formData.name} onChange={handleFormChange} required />
                            </div>
                            <div className="admin-form-group">
                                <label className="admin-form-label">College Email</label>
                                <input className="admin-form-input" name="emailId" type="email" placeholder="22cs001@college.edu" value={formData.emailId} onChange={handleFormChange} required />
                            </div>
                        </div>
                        <div className="admin-form-row">
                            <div className="admin-form-group">
                                <label className="admin-form-label">Register Number (Username)</label>
                                <input className="admin-form-input" name="registrationNumber" placeholder="e.g. REG2001" value={formData.registrationNumber} onChange={handleFormChange} required />
                            </div>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Roll No (Password)</label>
                                <input className="admin-form-input" name="rollNumber" placeholder="e.g. R1001" value={formData.rollNumber} onChange={handleFormChange} />
                            </div>
                        </div>
                        <div className="admin-form-row">
                            <div className="admin-form-group">
                                <label className="admin-form-label">Department</label>
                                <select className="admin-form-select" name="department" value={formData.department} onChange={handleFormChange}>
                                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Class / Section</label>
                                <select className="admin-form-select" name="classSection" value={formData.classSection} onChange={handleFormChange}>
                                    {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ marginTop: '8px' }}>
                            <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting} style={{ width: 'auto' }}>
                                {submitting ? 'Enrolling...' : 'Enrol Student'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Bulk Upload */}
            {activeTab === 'bulk' && (
                <div className="admin-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Bulk Student Upload
                            </h3>
                            <p style={{ fontSize: '13px', color: '#94A3B8' }}>
                                Upload a CSV file. Students are auto-sorted and assigned by class.
                            </p>
                        </div>
                        <button className="admin-btn admin-btn-secondary" onClick={handleDownloadTemplate}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download Template
                        </button>
                    </div>

                    <div className="admin-form-group" style={{ marginBottom: '20px', maxWidth: '300px' }}>
                        <label className="admin-form-label">Department for Bulk Upload</label>
                        <select className="admin-form-select" value={bulkDepartment} onChange={(e) => setBulkDepartment(e.target.value)}>
                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    {/* Drop Zone */}
                    <div
                        className={`admin-upload-zone ${dragOver ? 'dragover' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        <div className="admin-upload-zone-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        {selectedFile ? (
                            <div>
                                <div className="admin-upload-zone-text">{selectedFile.name}</div>
                                <div className="admin-upload-zone-sub">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                            </div>
                        ) : (
                            <div>
                                <div className="admin-upload-zone-text">Click to upload CSV file</div>
                                <div className="admin-upload-zone-sub">Columns: S.No, Class, Roll No, Reg No, Name, Email</div>
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                        />
                    </div>

                    {selectedFile && (
                        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                            <button className="admin-btn admin-btn-primary" onClick={handleBulkUpload} disabled={uploading}>
                                {uploading ? 'Uploading...' : 'Upload and Enrol'}
                            </button>
                            <button className="admin-btn admin-btn-secondary" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OnboardStudent;
