import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "../hooks/useSession";
import {
  deleteCompareList,
  listCompareLists,
  listWatchlist,
  removeWatchlistItem,
} from "../lib/api";

export function AccountPanel() {
  const queryClient = useQueryClient();
  const { accessToken, isConfigured, session } = useSession();
  const watchlistQuery = useQuery({
    queryKey: ["watchlist", accessToken],
    queryFn: () => listWatchlist(accessToken),
    enabled: Boolean(accessToken),
  });
  const compareListsQuery = useQuery({
    queryKey: ["compare-lists", accessToken],
    queryFn: () => listCompareLists(accessToken),
    enabled: Boolean(accessToken),
  });
  const removeWatchlistMutation = useMutation({
    mutationFn: (code: string) => removeWatchlistItem(code, accessToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });
  const deleteCompareListMutation = useMutation({
    mutationFn: (id: string) => deleteCompareList(id, accessToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compare-lists"] }),
  });

  if (!isConfigured) {
    return (
      <section className="account-panel">
        <h2>个人分析工作台</h2>
        <p>配置 Supabase 后，可使用 Google 登录保存自选基金和常用对比列表。</p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="account-panel">
        <h2>个人分析工作台</h2>
        <p>登录后保存自选基金和常用对比列表，方便持续跟踪同一组基金。</p>
      </section>
    );
  }

  return (
    <section className="account-grid">
      <article className="account-panel">
        <div className="panel-title-row">
          <h2>我的自选</h2>
          <span>{watchlistQuery.data?.length ?? 0} 只</span>
        </div>
        {(watchlistQuery.data ?? []).length === 0 ? (
          <p>从基金详情页保存自选基金。</p>
        ) : (
          <div className="saved-list">
            {(watchlistQuery.data ?? []).map((item) => (
              <div className="saved-row" key={item.code}>
                <Link to={`/funds/${item.code}`}>
                  {item.code} · {item.name}
                </Link>
                <button onClick={() => removeWatchlistMutation.mutate(item.code)}>移除</button>
              </div>
            ))}
          </div>
        )}
      </article>
      <article className="account-panel">
        <div className="panel-title-row">
          <h2>保存的对比</h2>
          <span>{compareListsQuery.data?.length ?? 0} 组</span>
        </div>
        {(compareListsQuery.data ?? []).length === 0 ? (
          <p>在对比页保存常用基金组合。</p>
        ) : (
          <div className="saved-list">
            {(compareListsQuery.data ?? []).map((item) => (
              <div className="saved-row" key={item.id}>
                <Link to={`/compare?codes=${item.codes.join(",")}`}>{item.name}</Link>
                <button onClick={() => deleteCompareListMutation.mutate(item.id)}>
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
