import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

function Navbar() {
  const { logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="logo">
          <Link to={isAuthenticated ? "/" : "/messages"}>FACE Prep</Link>
        </div>
        <ul className="nav-menu">
          {isAuthenticated && (
            <li className="nav-item">
              <Link to="/" className="nav-link">Home</Link>
            </li>
          )}
          <li className="nav-item">
            <Link to="/messages" className="nav-link">Messages</Link>
          </li>
          {isAuthenticated ? (
            <li className="nav-item">
              <button onClick={handleLogout} className="logout-button">Logout</button>
            </li>
          ) : (
            <li className="nav-item">
              <Link to="/login" className="nav-link login-link">Login</Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar; 