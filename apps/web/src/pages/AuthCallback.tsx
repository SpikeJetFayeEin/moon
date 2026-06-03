import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "../lib/supabase";

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function finishSignIn() {
      if (!supabase) {
        setError("Supabase 尚未配置。");
        return;
      }

      const providerError = searchParams.get("error_description") ?? searchParams.get("error");
      if (providerError) {
        setError(providerError);
        return;
      }

      const code = searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (isMounted) setError(exchangeError.message);
          return;
        }
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setError("未找到登录会话。");
          return;
        }
      }

      if (isMounted) navigate("/", { replace: true });
    }

    finishSignIn();
    return () => {
      isMounted = false;
    };
  }, [navigate, searchParams]);

  return (
    <main className="page-grid">
      <section className="analysis-panel">
        <h1>{error ? "登录失败" : "正在完成登录..."}</h1>
        {error ? (
          <>
            <p>{error}</p>
            <Link className="primary-button as-link" to="/">
              返回首页
            </Link>
          </>
        ) : (
          <p>请稍候，正在处理 Google 登录回调。</p>
        )}
      </section>
    </main>
  );
}
