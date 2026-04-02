import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import './student.css';

const StudentLayout: React.FC = () => {
  const navigate = useNavigate();
  
  React.useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser || storedUser === 'undefined') {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="student-layout">
      <nav className="student-nav">
        <div className="brand">
          <img src={logo} alt="DevBeeZ Logo" className="brand-logo" />
          <span style={{color: 'white'}}>Dev</span>BeeZ <span style={{fontSize: '1rem', color: '#a0a5b5'}}>StudentPortal</span>
        </div>
        
        <div className="student-nav-links">
          <NavLink to="/student" end className={({isActive}) => isActive ? "student-nav-link active" : "student-nav-link"}>Dashboard</NavLink>
          <NavLink to="/student/quiz" className={({isActive}) => isActive ? "student-nav-link active" : "student-nav-link"}>Quiz Arenas</NavLink>
          <NavLink to="/student/code" className={({isActive}) => isActive ? "student-nav-link active" : "student-nav-link"}>Code Arenas</NavLink>
        </div>
        
        <button className="student-profile-btn" onClick={handleLogout}>
          Logout Exit
        </button>
      </nav>

      <main className="student-page-content">
        <Outlet />
      </main>
    </div>
  );
};

export default StudentLayout;
