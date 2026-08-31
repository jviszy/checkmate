import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { ProtectedRoute, AdminRoute, CoachRoute } from './routes/Guards.jsx';

import Landing from './pages/Landing.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Matches from './pages/Matches.jsx';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Coach from './pages/Coach.jsx';
import Admin from './pages/Admin.jsx';
import Play from './pages/Play.jsx';
import Account from './pages/Account.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/play/:gameId" element={<Play />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
        <Route
          path="/coach"
          element={<CoachRoute><Coach /></CoachRoute>}
        />
        <Route
          path="/admin"
          element={<AdminRoute><Admin /></AdminRoute>}
        />
        <Route
          path="/account"
          element={<ProtectedRoute><Account /></ProtectedRoute>}
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
