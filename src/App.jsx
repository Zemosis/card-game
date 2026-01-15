// APP - Main Application Component with Routing

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainMenu from './pages/MainMenu';
import GameThirteen from './pages/GameThirteen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main Menu - Landing Page */}
        <Route path="/" element={<MainMenu />} />
        
        {/* Game "13" - Main Game */}
        <Route path="/game-13" element={<GameThirteen />} />
        
        {/* Muushig - Coming Soon (Redirect to Main Menu) */}
        <Route path="/muushig" element={<Navigate to="/" replace />} />
        
        {/* 404 - Redirect to Main Menu */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
