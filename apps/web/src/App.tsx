import { FormEvent, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { AuthButton } from "./components/AuthButton";
import { AuthCallback } from "./pages/AuthCallback";
import { Compare } from "./pages/Compare";
import { Dashboard } from "./pages/Dashboard";
import { FundDetail } from "./pages/FundDetail";
import { IndexDetail } from "./pages/IndexDetail";
import { PortfolioBacktest } from "./pages/PortfolioBacktest";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [globalQuery, setGlobalQuery] = useState("");

  useEffect(() => {
    if (location.pathname === "/") {
      setGlobalQuery(new URLSearchParams(location.search).get("q") ?? "");
    }
  }, [location.pathname, location.search]);

  function submitGlobalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = globalQuery.trim();
    navigate(query ? `/?q=${encodeURIComponent(query)}` : "/");
  }

  return (
    <div>
      <header className="terminal-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy">
            <strong>Fund Analytics</strong>
          </span>
        </Link>
        <nav>
          <NavLink to="/">筛选</NavLink>
          <NavLink to="/indices/ndx">指数</NavLink>
          <NavLink to="/portfolio">组合</NavLink>
          <NavLink to="/compare">对比</NavLink>
        </nav>
        <form className="command-search" aria-label="全局基金检索" onSubmit={submitGlobalSearch}>
          <input
            aria-label="搜索基金名称、代码、经理或公司"
            onChange={(event) => setGlobalQuery(event.target.value)}
            placeholder="搜索基金名称/代码/经理/公司"
            value={globalQuery}
          />
          <button aria-label="执行搜索" type="submit">⌕</button>
        </form>
        <div className="terminal-actions">
          <span>♡ 自选</span>
          <span>数据更新：2025-05-30</span>
          <span aria-hidden="true">◐</span>
          <AuthButton />
        </div>
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
