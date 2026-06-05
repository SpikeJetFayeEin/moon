import { Link, NavLink, Route, Routes } from "react-router-dom";

import { AuthButton } from "./components/AuthButton";
import { AuthCallback } from "./pages/AuthCallback";
import { Compare } from "./pages/Compare";
import { Dashboard } from "./pages/Dashboard";
import { FundDetail } from "./pages/FundDetail";
import { IndexDetail } from "./pages/IndexDetail";
import { PortfolioBacktest } from "./pages/PortfolioBacktest";

export default function App() {
  return (
    <div>
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark">◐</span>
          <span className="brand-copy">
            <span>Moon</span>
            <strong>Fund Analytics</strong>
          </span>
        </Link>
        <nav>
          <NavLink to="/">筛选</NavLink>
          <NavLink to="/indices/ndx">指数</NavLink>
          <NavLink to="/portfolio">组合</NavLink>
          <NavLink to="/compare">对比</NavLink>
        </nav>
        <div className="command-search" aria-label="全局检索提示">
          <span>搜索基金 / 指数 / 组合</span>
          <kbd>⌘K</kbd>
        </div>
        <AuthButton />
      </header>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/funds/:code" element={<FundDetail />} />
        <Route path="/indices/:code" element={<IndexDetail />} />
        <Route path="/portfolio" element={<PortfolioBacktest />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </div>
  );
}
