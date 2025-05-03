import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Upload from './components/Upload/Upload';
import Messages from './components/Messages/Messages';
import Login from './components/Login/Login';
import Navbar from './components/Navbar/Navbar';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import './App.css';

// NavbarWrapper component to conditionally render navbar
function NavbarWrapper() {
  const location = useLocation();
  // Hide navbar on Messages page
  const shouldShowNavbar = location.pathname !== '/messages';
  
  return shouldShowNavbar ? <Navbar /> : null;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Home route with protection */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={
                <>
                  <Navbar />
                  <div className="content">
                    <Upload />
                  </div>
                </>
              } />
            </Route>
            
            {/* Messages route without protection - directly accessible */}
            <Route path="/messages" element={
              <div className="content full-width">
                <Messages />
              </div>
            } />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App; 