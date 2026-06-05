from datetime import date

from app.services.sync import (
    normalize_akshare_fund_rows,
    normalize_akshare_fund_profile_rows,
    normalize_akshare_fund_performance_rows,
    normalize_akshare_nav_rows,
    sync_fund_to_supabase,
    sync_funds_to_supabase,
    sync_indices_to_supabase,
)


class FakeTableQuery:
    def __init__(self, table_name: str, calls: list[tuple]):
        self.table_name = table_name
        self.calls = calls

    def upsert(self, payload, **kwargs):
        self.calls.append(("upsert", self.table_name, payload, kwargs))
        return self

    def execute(self):
        return self


class FakeSupabaseClient:
    def __init__(self):
        self.calls: list[tuple] = []

    def table(self, table_name: str) -> FakeTableQuery:
        self.calls.append(("table", table_name))
        return FakeTableQuery(table_name, self.calls)


def test_normalizes_akshare_fund_rows_for_database_schema():
    rows = [
        {
            "基金代码": "000300",
            "基金简称": "沪深300指数增强",
            "基金类型": "指数增强",
            "基金经理": "张三",
        }
    ]

    normalized = normalize_akshare_fund_rows(rows)

    assert normalized == [
        {
            "code": "000300",
            "name": "沪深300指数增强",
            "fund_type": "指数增强",
            "manager": "未知",
            "fund_manager": "张三",
            "inception_date": date(1970, 1, 1),
            "latest_nav": None,
            "latest_nav_date": None,
            "asset_size_billion": 0,
        }
    ]


def test_normalizes_xueqiu_fund_profile_rows_for_detail_schema():
    rows = [
        {"item": "基金代码", "value": "005094"},
        {"item": "基金名称", "value": "万家臻选混合A"},
        {"item": "基金全称", "value": "万家臻选混合型证券投资基金"},
        {"item": "成立时间", "value": "2017-12-20"},
        {"item": "最新规模", "value": "21.22亿"},
        {"item": "基金公司", "value": "万家基金"},
        {"item": "基金经理", "value": "莫海波"},
        {"item": "托管银行", "value": "中国工商银行"},
        {"item": "基金类型", "value": "混合型"},
        {"item": "评级机构", "value": None},
        {"item": "基金评级", "value": None},
        {"item": "投资策略", "value": "精选个股。"},
        {"item": "投资目标", "value": "追求长期稳定增值。"},
        {"item": "业绩比较基准", "value": "沪深300指数收益率*80%+上证国债指数收益率*20%"},
    ]

    normalized = normalize_akshare_fund_profile_rows("005094", rows)

    assert normalized == {
        "code": "005094",
        "name": "万家臻选混合A",
        "full_name": "万家臻选混合型证券投资基金",
        "inception_date": date(2017, 12, 20),
        "asset_size_billion": 21.22,
        "fund_company": "万家基金",
        "fund_manager": "莫海波",
        "custodian": "中国工商银行",
        "fund_type": "混合型",
        "rating_source": None,
        "rating": None,
        "investment_strategy": "精选个股。",
        "investment_target": "追求长期稳定增值。",
        "benchmark": "沪深300指数收益率*80%+上证国债指数收益率*20%",
    }


def test_normalizes_xueqiu_fund_performance_rows_for_detail_schema():
    rows = [
        {
            "业绩类型": "阶段业绩",
            "周期": "近1年",
            "本产品区间收益": 135.620993,
            "本产品最大回撒": 12.56,
            "周期收益同类排名": "335/4562",
        },
        {
            "业绩类型": "年度业绩",
            "周期": "2025",
            "本产品区间收益": 66.38,
            "本产品最大回撒": 22.88,
            "周期收益同类排名": "388/5118",
        },
    ]

    normalized = normalize_akshare_fund_performance_rows(rows)

    assert normalized == [
        {
            "performance_type": "stage",
            "period": "近1年",
            "return_rate": 1.35620993,
            "max_drawdown": -0.1256,
            "rank": "335/4562",
        },
        {
            "performance_type": "year",
            "period": "2025",
            "return_rate": 0.6638,
            "max_drawdown": -0.2288,
            "rank": "388/5118",
        },
    ]


def test_sync_funds_to_supabase_upserts_funds_and_nav_rows():
    client = FakeSupabaseClient()
    fund_rows = [{"基金代码": "000300", "基金简称": "沪深300指数增强", "基金类型": "指数增强"}]

    def nav_provider(code: str):
        assert code == "000300"
        return [{"净值日期": date(2026, 5, 29), "单位净值": "1.2345", "累计净值": "1.2345"}]

    result = sync_funds_to_supabase(client, fund_rows, nav_provider)

    assert result.funds_seen == 1
    assert result.nav_rows_seen == 1
    assert ("table", "funds") in client.calls
    assert ("table", "fund_nav") in client.calls
    assert any(call[0] == "upsert" and call[1] == "funds" for call in client.calls)
    assert any(call[0] == "upsert" and call[1] == "fund_nav" for call in client.calls)


def test_sync_funds_to_supabase_merges_profile_rows_when_provider_is_configured():
    client = FakeSupabaseClient()

    result = sync_funds_to_supabase(
        client,
        fund_rows=[{"基金代码": "005094", "基金简称": "万家臻选混合A", "基金类型": "混合型"}],
        nav_provider=lambda code: [],
        profile_provider=lambda code: [
            {"item": "基金代码", "value": code},
            {"item": "基金名称", "value": "万家臻选混合A"},
            {"item": "基金公司", "value": "万家基金"},
            {"item": "基金经理", "value": "莫海波"},
            {"item": "托管银行", "value": "中国工商银行"},
            {"item": "业绩比较基准", "value": "沪深300指数收益率*80%+上证国债指数收益率*20%"},
        ],
    )

    fund_upserts = [call for call in client.calls if call[0] == "upsert" and call[1] == "funds"]
    assert result.funds_seen == 1
    assert fund_upserts[-1][2][0]["fund_manager"] == "莫海波"
    assert fund_upserts[-1][2][0]["custodian"] == "中国工商银行"
    assert fund_upserts[-1][2][0]["benchmark"] == "沪深300指数收益率*80%+上证国债指数收益率*20%"


def test_sync_funds_to_supabase_upserts_performance_rows_when_provider_is_configured():
    client = FakeSupabaseClient()

    result = sync_funds_to_supabase(
        client,
        fund_rows=[{"基金代码": "005094", "基金简称": "万家臻选混合A", "基金类型": "混合型"}],
        nav_provider=lambda code: [],
        performance_provider=lambda code: [
            {
                "业绩类型": "阶段业绩",
                "周期": "近1年",
                "本产品区间收益": 135.620993,
                "本产品最大回撒": 12.56,
                "周期收益同类排名": "335/4562",
            }
        ],
    )

    assert result.funds_seen == 1
    assert (
        "upsert",
        "fund_performance",
        [
            {
                "code": "005094",
                "performance_type": "stage",
                "period": "近1年",
                "return_rate": 1.35620993,
                "max_drawdown": -0.1256,
                "rank": "335/4562",
            }
        ],
        {"on_conflict": "code,performance_type,period"},
    ) in client.calls


def test_sync_fund_to_supabase_syncs_one_selected_fund():
    client = FakeSupabaseClient()

    result = sync_fund_to_supabase(
        client,
        fund_row={
            "code": "005094",
            "name": "万家臻选混合A",
            "fund_type": "混合型",
            "manager": "万家基金",
            "fund_manager": "莫海波",
            "inception_date": date(2017, 12, 20),
            "latest_nav": None,
            "latest_nav_date": None,
            "asset_size_billion": 21.22,
        },
        nav_provider=lambda code: [
            {"净值日期": date(2026, 5, 29), "单位净值": "5.9512", "累计净值": "5.9512"}
        ],
        performance_provider=lambda code: [
            {
                "业绩类型": "阶段业绩",
                "周期": "近1年",
                "本产品区间收益": 12.5,
                "本产品最大回撒": 8.2,
                "周期收益同类排名": "100/1000",
            }
        ],
    )

    assert result.funds_seen == 1
    assert result.nav_rows_seen == 1
    assert any(call[0] == "upsert" and call[1] == "fund_nav" for call in client.calls)
    assert any(call[0] == "upsert" and call[1] == "fund_performance" for call in client.calls)


def test_normalizes_nav_rows_without_accumulated_nav():
    normalized = normalize_akshare_nav_rows(
        [{"净值日期": date(2026, 5, 29), "单位净值": "1.2345"}]
    )

    assert normalized == [
        {
            "date": date(2026, 5, 29),
            "nav": 1.2345,
            "accumulated_nav": 1.2345,
        }
    ]


def test_sync_indices_to_supabase_upserts_index_metadata_and_nav_rows():
    client = FakeSupabaseClient()

    result = sync_indices_to_supabase(
        client,
        indices=[
            {
                "code": "ndx",
                "name": "纳斯达克100全收益指数",
                "symbol": "XNDX",
                "return_type": "total_return",
                "currency": "USD",
                "provider": "Nasdaq Global Index Watch",
                "description": "全收益指数",
            }
        ],
        nav_provider=lambda code: [
            {"code": code, "date": date(2020, 1, 2), "nav": 1, "raw_value": 100},
            {"code": code, "date": date(2020, 1, 3), "nav": 1.1, "raw_value": 110},
        ],
    )

    assert result.indices_seen == 1
    assert result.nav_rows_seen == 2
    assert ("table", "market_indices") in client.calls
    assert ("table", "market_index_nav") in client.calls
    assert any(call[0] == "upsert" and call[1] == "market_indices" for call in client.calls)
    assert any(call[0] == "upsert" and call[1] == "market_index_nav" for call in client.calls)
