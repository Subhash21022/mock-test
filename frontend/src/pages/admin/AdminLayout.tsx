import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import './admin.css';
import devbeezLogo from '../../assets/devbeez-logo.png';

const AdminLayout = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser || storedUser === 'undefined') {
            navigate('/login');
            return;
        }
        try {
            const user = JSON.parse(storedUser);
            if (user.role !== 'admin') {
                navigate('/login');
            }
        } catch {
            navigate('/login');
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    const navItems = [
        { path: '/admin', label: 'Dashboard', exact: true },
        { path: '/admin/create-test', label: 'Create Quiz' },
        { path: '/admin/manage-tests', label: 'Manage Quizzes' },
        { path: '/admin/performance', label: 'Reports' },
        { path: '/admin/onboard', label: 'Onboard Student' },
        { path: '/admin/manage-students', label: 'Manage Students' },
        { path: '/admin/upload-documents', label: 'Upload Documents' },
    ];

    return (
        <div className="admin-layout">
            <nav className="admin-nav">
                <div className="admin-nav-left">
                    <div className="admin-nav-brand" onClick={() => navigate('/admin')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={devbeezLogo} alt="DevBeeZ Logo" style={{ width: '36px', height: 'auto', borderRadius: '4px' }} />
                        <div>
                            <div className="admin-nav-brand-name">DevBeeZ</div>
                            <div className="admin-nav-brand-tag">AdminPortal</div>
                        </div>
                    </div>
                    <div className="admin-nav-links">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.exact}
                                className={({ isActive }) =>
                                    `admin-nav-link ${isActive ? 'active' : ''}`
                                }
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </div>
                </div>
                <div className="admin-nav-right">
                    <div className="admin-nav-user">
                        <div className="admin-nav-user-info">
                            <div className="admin-nav-user-name">Admin</div>
                            <div className="admin-nav-user-email">admin@gmail.com</div>
                        </div>
                    </div>
                    <button className="admin-nav-logout" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </nav>
            <div className="admin-content">
                <Outlet />
            </div>
        </div>
    );
};

export default AdminLayout;
