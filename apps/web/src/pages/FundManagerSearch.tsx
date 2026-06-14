import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { MetricStrip } from "../components/MetricStrip";
import { QueryStatePanel } from "../components/QueryStatePanel";
import { searchFundManagers, syncFundManagers } from "../lib/api";

export function FundManagerSearch() {
  const queryClient = useQueryClient();
  const [queryText, setQueryText] = useState("高");
  const managersQuery = useQuery({
    queryKey: ["fund-managers", queryText],
    queryFn: () => searchFundManagers(queryText),
  });
  const syncMutation = useMutation({
    mutationFn: syncFundManagers,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["fund-managers"] });
    },
  });
  const managers = managersQuery.data?.items ?? [];

  return (
    <main className="manager-search">
      <section className="manager-command">
        <div>
          <p className="eyebrow">Fund Manager</p>
          <h1>基金经理搜索</h1>
          <p>按姓名或基金公司查找基金经理，进入在管产品的风险收益对比。</p>
        </div>
        <div className="manager-search-actions">
          <label>
            搜索
            <input
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="输入基金经理或公司"
              value={queryText}
            />
          </label>
          <button
            className="primary-button"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
            type="button"
          >
            {syncMutation.isPending ? "同步中..." : "同步经理数据"}
          </button>
        </div>
      </section>

      <MetricStrip
        items={[
          { label: "搜索结果", value: String(managers.length), detail: "基金经理" },
          {
            label: "同步状态",
            value: syncMutation.data?.status ?? "待操作",
            detail: syncMutation.data ? `${syncMutation.data.tenures_seen} 条关系` : "AKShare",
            tone: syncMutation.isError ? "bad" : "accent",
          },
        ]}
      />

      {managersQuery.isLoading ? (
        <QueryStatePanel title="正在搜索基金经理" description="正在读取基金经理和在管产品关系。" tone="loading" />
      ) : managers.length ? (
        <section className="manager-results">
          {managers.map((manager) => (
            <Link className="manager-result-row" key={manager.manager_id} to={`/managers/${manager.manager_id}`}>
              <strong>{manager.name}</strong>
              <span>{manager.company}</span>
              <small>{manager.active_product_count} 只在管产品</small>
              <small>更新 {manager.synced_at}</small>
            </Link>
          ))}
        </section>
      ) : (
        <QueryStatePanel title="暂无基金经理" description="请调整搜索词，或先同步基金经理数据。" tone="error" />
      )}
    </main>
  );
}
