import { Link, NavLink, Route, Routes } from "react-router-dom";

import { AssetAnalysis } from "./pages/AssetAnalysis";
import { SyncDashboard } from "./pages/SyncDashboard";

export default function App() {
  return (
    <div>
      <header className="terminal-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy">
            <strong>Moon Analytics</strong>
          </span>
        </Link>
        <nav>
          <NavLink to="/">数据同步</NavLink>
          <NavLink to="/analysis/fund/000300">单项分析</NavLink>
        </nav>
        <div className="terminal-actions">
          <span>基金/指数数据工作台</span>
          <span>核心功能 2 项</span>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<SyncDashboard />} />
        <Route path="/analysis/:assetType/:code" element={<AssetAnalysis />} />
      </Routes>
    </div>
  );
}
