import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

export function AuthButton() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) {
    return <span className="auth-badge">未配置 Supabase</span>;
  }

  if (session) {
    return (
      <button className="ghost-button" onClick={() => supabase.auth.signOut()}>
        退出 {session.user.email}
      </button>
    );
  }

  return (
    <button
      className="primary-button"
      onClick={() =>
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        })
      }
    >
      使用 Google 登录
    </button>
  );
}
