// APP - Main Application Component with Routing

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainMenu from './pages/MainMenu';
import GameThirteen from './pages/GameThirteen';
import LobbySelection from './pages/LobbySelection'; 

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<MainMenu />} />
          <Route path="/game-13" element={<GameThirteen />} />
          {/* NEW: Add the route for the lobby */}
          <Route path="/lobby-13" element={<LobbySelection />} /> 
        </Routes>
      </div>
    </Router>
  );
}

export default App;
