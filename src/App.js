import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Upload from './components/Upload/Upload';
import Messages from './components/Messages/Messages';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Upload />} />
          <Route path="/messages" element={<Messages />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App; 