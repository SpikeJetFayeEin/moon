import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";

export function AuthButton() {
  const { session, isConfigured, isLoading } = useSession();
  const client = supabase;

  if (!isConfigured || !client) {
    return <span className="auth-badge">未配置 Supabase</span>;
  }

  if (isLoading) {
    return <span className="auth-badge">登录状态检查中</span>;
  }

  if (session) {
    return (
      <button className="ghost-button" onClick={() => client.auth.signOut()}>
        退出 {session.user.email}
      </button>
    );
  }

  return (
    <button
      className="primary-button"
      onClick={() =>
        client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        })
      }
    >
      使用 Google 登录
    </button>
  );
}
