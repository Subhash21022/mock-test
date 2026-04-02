import { API_BASE_URL } from '../config';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormInput from '../components/FormInput';
import './LoginPage.css';

const LoginPage = () => {
    const [formData, setFormData] = useState({ username: '', password: '' });
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        console.log('Login attempt with', formData);
        
        // --- DEVELOPMENT BYPASS ---
        if (formData.username === 'admin@gmail.com' && formData.password === '123') {
            localStorage.setItem('user', JSON.stringify({
                _id: 1,
                email: 'admin@gmail.com',
                role: 'admin',
                name: 'Admin',
                profile_image: '',
                message: 'Login successful'
            }));
            navigate('/admin');
            return;
        }

        if (formData.username === 'student@gmail.com' && formData.password === '123') {
            localStorage.setItem('user', JSON.stringify({
                _id: 2,
                email: 'student@gmail.com',
                role: 'student',
                name: 'Demo Student',
                profile_image: '',
                message: 'Login successful'
            }));
            navigate('/student');
            return;
        }
        // --------------------------

        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('user', JSON.stringify(data));
                if (data.role === 'admin') {
                    navigate('/admin');
                } else {
                    navigate('/student');
                }
            } else {
                alert(data.message || 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Failed to connect to backend server');
        }
    };

    return (
        <div className="login-container">
            {/* Background with skewed splits */}
            <div className="split-bg white-panel"></div>
            <div className="split-bg mustard-panel"></div>

            {/* Content Overlay */}
            <div className="content-wrapper">
                <div className="left-content animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="form-wrapper">
                        <h1 className="logo-text">DevBeeZ<span className="dot">.</span></h1>
                        <div className="form-header">
                            <h2>Welcome Back</h2>
                            <p>Log in to access your mock interview dashboard.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="login-form">
                            <FormInput
                                label="Username / Reg No"
                                name="username"
                                type="text"
                                placeholder="roll@gmail.com"
                                value={formData.username}
                                onChange={handleChange}
                                required
                            />
                            <FormInput
                                label="Password"
                                name="password"
                                type="password"
                                placeholder="312324xxx"
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />

                            <div className="form-actions">
                                <a href="#" className="forgot-link">Forgot password?</a>
                            </div>

                            <button type="submit" className="btn-primary">
                                Log In To Dashboard
                            </button>
                        </form>

                        <p className="signup-prompt">
                            Don't have an account? <a href="#">Create one</a>
                        </p>
                    </div>
                </div>

                <div className="right-content animate-fade-in" style={{ animationDelay: '0.3s' }}>
                    <div className="branding-glass">
                        <div className="bee-icon">
                            {/* Abstract Technical Bee Representation */}
                            <svg width="220" height="220" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <clipPath id="loginAbdomenClip">
                                    <path d="M 80 105 Q 60 140 100 185 Q 140 140 120 105 Z" />
                                </clipPath>
                                <g stroke="#000" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" fill="none">
                                    <path d="M 116 48 L 160 35 L 190 55 L 170 85 L 126 85" />
                                    <path d="M 116 68 L 190 55" />
                                    <path d="M 170 85 L 164 115 L 124 115 L 112 105" />
                                    <path d="M 115 95 L 150 105" />
                                    <path d="M 124 115 L 124 140" />
                                    <path d="M 84 48 L 40 35 L 10 55 L 30 85 L 74 85" />
                                    <path d="M 84 68 L 10 55" />
                                    <path d="M 30 85 L 36 115 L 76 115 L 88 105" />
                                    <path d="M 85 95 L 50 105" />
                                    <path d="M 76 115 L 76 140" />
                                </g>
                                <g stroke="#000" strokeWidth="6" fill="#F4B400">
                                    <circle cx="153" cy="61.5" r="5" />
                                    <circle cx="190" cy="55" r="5" />
                                    <circle cx="150" cy="105" r="5" />
                                    <circle cx="124" cy="140" r="5" />
                                    <circle cx="47" cy="61.5" r="5" />
                                    <circle cx="10" cy="55" r="5" />
                                    <circle cx="50" cy="105" r="5" />
                                    <circle cx="76" cy="140" r="5" />
                                </g>
                                <path d="M 92 36 Q 85 15 70 18" stroke="#000" strokeWidth="6" strokeLinecap="round" fill="none" />
                                <path d="M 108 36 Q 115 15 130 18" stroke="#000" strokeWidth="6" strokeLinecap="round" fill="none" />
                                <circle cx="70" cy="18" r="5" fill="#F4B400" stroke="#000" strokeWidth="6" />
                                <circle cx="130" cy="18" r="5" fill="#F4B400" stroke="#000" strokeWidth="6" />
                                <path d="M 80 105 Q 60 140 100 185 Q 140 140 120 105 Z" fill="#F4B400" />
                                <rect x="50" y="125" width="100" height="23" fill="#000" clipPath="url(#loginAbdomenClip)" />
                                <path d="M 80 105 Q 60 140 100 185 Q 140 140 120 105 Z" fill="none" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
                                <circle cx="100" cy="50" r="22" fill="#000" />
                                <circle cx="100" cy="85" r="28" fill="#F4B400" stroke="#000" strokeWidth="6" />
                                <g stroke="#000" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                                    <path d="M 88 77 L 79 85 L 88 93" />
                                    <path d="M 102 96 L 98 74" />
                                    <path d="M 112 77 L 121 85 L 112 93" />
                                </g>
                            </svg>
                        </div>
                        <h2 className="branding-title">Master Your Interviews</h2>
                        <p className="branding-subtitle">
                            Join the hive. Prepare with AI-driven mock interviews configured for top tech companies.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
