from __future__ import annotations

"""
LLM unified dispatch router.
Routes calls to quick (fast/cheap) or deep (reasoning) models via LiteLLM.
Falls back to mock responses when no valid API key is configured.
"""

import logging
from typing import Any, AsyncIterator

from fastapi import APIRouter

from app.config import get_settings
from app.llm.token_tracker import TokenTracker

logger = logging.getLogger(__name__)

router = APIRouter()

# Global instances
_token_tracker = TokenTracker()

# Try importing litellm - it may not be available or may fail
_try_litellm = True
_litellm_module = None
try:
    import litellm
    _litellm_module = litellm
    litellm.suppress_debug_info = True
except ImportError:
    _try_litellm = False
    logger.warning("litellm not installed, using mock LLM responses")

# Try importing fallback manager
_fallback_manager = None
try:
    from app.llm.fallback import FallbackManager
    _fallback_manager = FallbackManager()
except Exception:
    logger.warning("FallbackManager not available, using mock LLM responses")


def _is_configured() -> bool:
    """Check if a valid LLM API key is configured."""
    settings = get_settings()
    return settings.llm_api_key and settings.llm_api_key != "sk-xxx" and len(settings.llm_api_key) > 10


def _mock_response(content: str = "") -> dict[str, Any]:
    """Generate a mock LLM response for when no provider is configured."""
    return {
        "content": content,
        "tool_calls": None,
        "model": "mock",
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }


async def llm_quick_call(
    messages: list[dict[str, str]],
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
    tools: list[dict] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Make a quick LLM call (fast/cheap model).
    Uses the default provider configured via LLM_PROVIDER/LLM_MODEL.
    Falls back to mock responses when no provider is configured.
    """
    # If no valid API key, return mock response
    if not _is_configured() or not _try_litellm or _litellm_module is None:
        content = _generate_mock_analysis(messages, mode="quick")
        logger.info("Using mock LLM response (no valid API key configured)")
        return _mock_response(content)

    settings = get_settings()
    model = settings.litellm_quick_model
    temp = temperature if temperature is not None else settings.llm_temperature
    tokens = max_tokens if max_tokens is not None else settings.llm_max_tokens

    try:
        response = await _litellm_module.acompletion(
            model=model,
            messages=messages,
            temperature=temp,
            max_tokens=tokens,
            api_key=settings.llm_api_key,
            api_base=settings.llm_base_url,
            tools=tools,
            **kwargs,
        )
        # Track token usage
        _token_tracker.track(response, provider=settings.llm_provider)
        return _format_response(response)
    except Exception as e:
        logger.warning(f"Quick LLM call failed with {model}: {e}")
        if _fallback_manager:
            return await _fallback_manager.fallback_quick(messages, temperature=temp, max_tokens=tokens, tools=tools, **kwargs)
        content = _generate_mock_analysis(messages, mode="quick")
        return _mock_response(content)


async def llm_deep_call(
    messages: list[dict[str, str]],
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
    tools: list[dict] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    Make a deep LLM call (reasoning model).
    Uses the deep provider configured via LLM_DEEP_PROVIDER/LLM_DEEP_MODEL.
    Falls back to mock responses when no provider is configured.
    """
    # If no valid API key, return mock response
    if not _is_configured() or not _try_litellm or _litellm_module is None:
        content = _generate_mock_analysis(messages, mode="deep")
        logger.info("Using mock LLM response (no valid API key configured)")
        return _mock_response(content)

    settings = get_settings()
    model = settings.litellm_deep_model
    temp = temperature if temperature is not None else settings.llm_temperature
    tokens = max_tokens if max_tokens is not None else settings.llm_max_tokens

    try:
        response = await _litellm_module.acompletion(
            model=model,
            messages=messages,
            temperature=temp,
            max_tokens=tokens,
            api_key=settings.llm_api_key,
            api_base=settings.llm_base_url,
            tools=tools,
            **kwargs,
        )
        _token_tracker.track(response, provider=settings.llm_deep_provider)
        return _format_response(response)
    except Exception as e:
        logger.warning(f"Deep LLM call failed with {model}: {e}")
        if _fallback_manager:
            return await _fallback_manager.fallback_deep(messages, temperature=temp, max_tokens=tokens, tools=tools, **kwargs)
        content = _generate_mock_analysis(messages, mode="deep")
        return _mock_response(content)


async def llm_stream_call(
    messages: list[dict[str, str]],
    *,
    mode: str = "quick",
    temperature: float | None = None,
    max_tokens: int | None = None,
    **kwargs: Any,
) -> AsyncIterator[str]:
    """
    Make a streaming LLM call. Yields content chunks for SSE.
    Falls back to mock streaming when no provider is configured.
    """
    # If no valid API key, return mock response as stream
    if not _is_configured() or not _try_litellm or _litellm_module is None:
        content = _generate_mock_analysis(messages, mode=mode)
        logger.info("Using mock LLM streaming response (no valid API key configured)")
        # Simulate streaming by yielding chunks
        chunk_size = 10
        for i in range(0, len(content), chunk_size):
            yield content[i:i + chunk_size]
        return

    settings = get_settings()
    model = settings.litellm_quick_model if mode == "quick" else settings.litellm_deep_model
    temp = temperature if temperature is not None else settings.llm_temperature
    tokens = max_tokens if max_tokens is not None else settings.llm_max_tokens

    try:
        response = await _litellm_module.acompletion(
            model=model,
            messages=messages,
            temperature=temp,
            max_tokens=tokens,
            api_key=settings.llm_api_key,
            api_base=settings.llm_base_url,
            stream=True,
            **kwargs,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
    except Exception as e:
        logger.error(f"Streaming LLM call failed: {e}")
        # Fall back to mock streaming
        content = _generate_mock_analysis(messages, mode=mode)
        chunk_size = 10
        for i in range(0, len(content), chunk_size):
            yield content[i:i + chunk_size]


def _format_response(response: Any) -> dict[str, Any]:
    """Format a LiteLLM response into a standardized dict."""
    choice = response.choices[0] if response.choices else None
    return {
        "content": choice.message.content if choice and choice.message else "",
        "tool_calls": choice.message.tool_calls if choice and choice.message else None,
        "model": response.model or "",
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
            "completion_tokens": response.usage.completion_tokens if response.usage else 0,
            "total_tokens": response.usage.total_tokens if response.usage else 0,
        },
    }


def _generate_mock_analysis(messages: list[dict[str, str]], mode: str = "quick") -> str:
    """Generate a mock analysis response based on the message context."""
    # Extract system and user messages for context
    system_msg = ""
    user_msg = ""
    for msg in reversed(messages):
        if msg.get("role") == "user" and not user_msg:
            user_msg = msg.get("content", "")
        elif msg.get("role") == "system" and not system_msg:
            system_msg = msg.get("content", "")

    combined = system_msg + " " + user_msg

    # Check what kind of analysis is being requested
    # Order matters: check more specific patterns first
    if "最终投资决策" in combined or "决策顾问" in combined or "final decision" in combined.lower():
        return _MOCK_DECISION
    elif "看多研究员" in combined or "看多论据" in combined or "bull researcher" in combined.lower():
        return _MOCK_BULL
    elif "看空研究员" in combined or "看空论据" in combined or "bear researcher" in combined.lower():
        return _MOCK_BEAR
    elif "风险管理" in combined or "风险评估" in combined or "risk management" in combined.lower():
        return _MOCK_RISK
    elif "技术分析师" in combined or "技术指标" in combined or "technical analyst" in combined.lower():
        return _MOCK_TECHNICAL
    elif "基本面分析师" in combined or "财务数据" in combined or "fundamental analyst" in combined.lower():
        return _MOCK_FUNDAMENTAL
    elif "情绪分析师" in combined or "市场情绪" in combined or "sentiment analyst" in combined.lower():
        return _MOCK_SENTIMENT
    else:
        return _MOCK_CHAT


# Mock analysis responses
_MOCK_TECHNICAL = """## 技术分析报告

### 趋势判断
当前股票处于震荡上行趋势，短期均线呈现多头排列。

### 关键指标
- **MA5**: 短期均线上穿MA20，形成金叉信号
- **MACD**: DIF线在零轴上方运行，红柱逐渐放大
- **RSI(14)**: 当前值58.3，处于中性偏多区域
- **KDJ**: K线与D线在50上方金叉，J值为72.5
- **成交量**: 近5日成交量温和放大，量价配合良好

### 支撑与阻力
- 第一支撑位：近期低点附近
- 第二支撑位：MA60均线位置
- 第一阻力位：前期高点
- 第二阻力位：布林带上轨

### 技术面信号
**买入** - 短期技术指标偏多，建议关注回调买入机会。

> 注意：此为模拟分析数据，仅供测试使用。"""

_MOCK_FUNDAMENTAL = """## 基本面分析报告

### 财务概况
公司财务状况稳健，营收和利润保持增长态势。

### 估值分析
- **PE(TTM)**: 25.3x，处于行业中等水平
- **PB**: 4.2x，略高于行业平均
- **PS**: 6.8x，反映市场对成长性的溢价
- **ROE**: 18.5%，盈利能力较强

### 成长性
- 营收同比增长：12.3%
- 净利润同比增长：15.7%
- 毛利率：42.8%，保持稳定

### 行业地位
公司是行业龙头企业，市场份额领先，品牌壁垒高。

### 基本面评级
**买入** - 基本面扎实，估值合理，成长性良好。

> 注意：此为模拟分析数据，仅供测试使用。"""

_MOCK_SENTIMENT = """## 市场情绪分析报告

### 情绪评分
综合情绪评分：**65/100**（偏乐观）

### 新闻热点
1. 公司发布新产品，市场反响积极
2. 行业政策利好，板块整体走强
3. 机构研报普遍给予买入评级

### 市场情绪指标
- 北向资金：连续3日净流入
- 融资余额：环比增长2.3%
- 换手率：处于正常区间
- 龙虎榜：机构买入占比提升

### 情绪判断
**中性偏乐观** - 市场情绪整体偏暖，但需警惕短期过热风险。

> 注意：此为模拟分析数据，仅供测试使用。"""

_MOCK_BULL = """## 看多论据

### 核心观点
基于当前技术面和基本面的综合分析，我们认为该股票具有上涨潜力。

### 支撑因素
1. **技术面**：均线多头排列，MACD金叉确认，短期趋势向好
2. **基本面**：业绩增长稳健，ROE持续提升，估值仍有上行空间
3. **催化剂**：新产品发布在即，有望带来增量收入
4. **资金面**：北向资金持续流入，机构持仓增加

### 目标价位
6个月目标价：当前价格上行空间约15-20%

> 注意：此为模拟分析数据，仅供测试使用。"""

_MOCK_BEAR = """## 看空论据

### 核心观点
尽管当前市场情绪偏暖，但存在若干风险因素值得关注。

### 风险因素
1. **技术面**：RSI接近超买区域，短期存在回调压力
2. **基本面**：毛利率有收窄趋势，成本端压力增大
3. **宏观风险**：利率环境不确定性增加
4. **行业竞争**：新进入者增多，市场份额面临挑战

### 下行风险
若跌破关键支撑位，下行空间约10-15%

> 注意：此为模拟分析数据，仅供测试使用。"""

_MOCK_RISK = """## 风险评估报告

### 风险等级：**中等**

### 主要风险因素
1. **市场风险**：大盘波动可能带来系统性风险（权重：30%）
2. **行业风险**：行业政策变化可能影响估值（权重：25%）
3. **公司风险**：业绩不及预期的风险（权重：20%）
4. **流动性风险**：当前流动性充裕，风险较低（权重：15%）
5. **汇率风险**：海外业务占比有限，影响较小（权重：10%）

### 最大可能亏损
- 单日最大可能亏损：-5.2%
- 一周最大可能亏损：-12.3%

### 止损建议
- 短线止损：-5%
- 中线止损：-10%

### 风险对冲
建议通过仓位控制和止损策略管理风险，可考虑配置部分防御性资产。

> 注意：此为模拟分析数据，仅供测试使用。"""

_MOCK_DECISION = """## 投资建议
**买入** - 综合技术面、基本面和情绪面分析，建议适度买入。

## 目标价位
6个月目标价：当前价格上行空间约12-18%

## 止损建议
- 短线止损：跌破关键支撑位止损
- 中线止损：-10%止损

## 关键支撑论据
1. 技术面信号偏多，趋势向好
2. 基本面扎实，估值合理
3. 市场情绪中性偏乐观
4. 资金面持续改善

## 主要风险
1. 短期技术指标接近超买
2. 行业竞争加剧
3. 宏观环境不确定性

## 置信度
**中等** - 建议控制仓位，分批建仓。

> 注意：此为模拟分析数据，仅供测试使用。配置有效API密钥后可获取真实AI分析。"""

_MOCK_CHAT = """您好！我是QuantFusion智能投研助手。我可以帮助您：

1. 📊 分析股票的技术面、基本面和情绪面
2. 📰 解读市场数据和新闻
3. 💡 提供投资建议和风险提示
4. 📈 回答关于交易策略的问题

请告诉我您想了解哪只股票，或者有什么投资问题需要讨论？

> 注意：当前为模拟模式，配置有效API密钥后可获取真实AI分析。"""


# --- API endpoints ---

@router.get("/providers")
async def list_providers() -> dict:
    """List available LLM providers and their status."""
    settings = get_settings()
    providers = [
        {
            "name": settings.llm_provider,
            "model": settings.llm_model,
            "role": "quick",
            "base_url": settings.llm_base_url,
            "configured": settings.llm_api_key != "sk-xxx",
        },
        {
            "name": settings.llm_deep_provider,
            "model": settings.llm_deep_model,
            "role": "deep",
            "base_url": settings.llm_base_url,
            "configured": settings.llm_api_key != "sk-xxx",
        },
    ]
    return {"success": True, "data": {"providers": providers}, "error": None}


@router.get("/usage")
async def get_token_usage() -> dict:
    """Get token usage statistics."""
    stats = _token_tracker.get_stats()
    return {"success": True, "data": stats, "error": None}
