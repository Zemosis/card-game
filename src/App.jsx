// APP - Main Application Component with Routing

import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import MainMenu from "./pages/MainMenu";

const GameThirteen = lazy(() => import("./pages/thirteen/GameThirteen"));
const LobbySelection = lazy(() => import("./pages/thirteen/LobbySelection"));
const GameMuushig = lazy(() => import("./pages/muushig/GameMuushig"));
const LobbyMuushig = lazy(() => import("./pages/muushig/LobbyMuushig"));
const AvatarPaint = lazy(() => import("./pages/AvatarPaint"));

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Suspense>
            <Routes>
              <Route path="/" element={<MainMenu />} />
              <Route path="/lobby-13" element={<LobbySelection />} />
              <Route path="/game-13" element={<GameThirteen />} />
              <Route path="/lobby-muushig" element={<LobbyMuushig />} />
              <Route path="/game-muushig" element={<GameMuushig />} />
              <Route path="/avatar-paint" element={<AvatarPaint />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
