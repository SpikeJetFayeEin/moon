import { Link, NavLink, Route, Routes } from "react-router-dom";

import { AuthButton } from "./components/AuthButton";
import { Compare } from "./pages/Compare";
import { Dashboard } from "./pages/Dashboard";
import { FundDetail } from "./pages/FundDetail";

export default function App() {
  return (
    <div>
      <header className="app-header">
        <Link to="/" className="brand">
          <span>Moon</span>
          <strong>Fund Analytics</strong>
        </Link>
        <nav>
          <NavLink to="/">筛选</NavLink>
          <NavLink to="/compare">对比</NavLink>
        </nav>
        <AuthButton />
      </header>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/funds/:code" element={<FundDetail />} />
        <Route path="/compare" element={<Compare />} />
      </Routes>
    </div>
  );
}
