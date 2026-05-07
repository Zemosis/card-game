// APP - Main Application Component with Routing

import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import MainMenu from "./pages/MainMenu";
import GameThirteen from "./pages/thirteen/GameThirteen";
import LobbySelection from "./pages/thirteen/LobbySelection";
import GameMuushig from "./pages/muushig/GameMuushig";
import LobbyMuushig from "./pages/muushig/LobbyMuushig";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/" element={<MainMenu />} />
            {/* Game 13 */}
            <Route path="/lobby-13" element={<LobbySelection />} />
            <Route path="/game-13" element={<GameThirteen />} />
            {/* Muushig */}
            <Route path="/lobby-muushig" element={<LobbyMuushig />} />
            <Route path="/game-muushig" element={<GameMuushig />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
