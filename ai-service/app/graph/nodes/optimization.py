import json
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from app.config import settings
from app.models.campaign import OptimizationPlan
from app.graph.state import CRMAgentState
from app.tools.vector_tools import search_past_campaigns
from app.utils.callbacks import post_progress

OPTIMIZATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a campaign optimization expert for Zari fashion brand.
    Analyze current campaign results against historical benchmarks and make concrete recommendations.
    Be specific: name the winning variant, recommend exact send hour, suggest audience refinement.
    Always suggest 2-3 next campaign ideas based on the data.
    """),
    ("human", """Current campaign results:
{current_metrics}

Historical benchmark campaigns (similar goal/channel):
{historical_context}

Generate an optimization plan with:
1. Winning variant (A or B)
2. Optimal send hour (0-23)
3. Audience refinement suggestions
4. Next campaign ideas
5. One-line summary
"""),
])


def optimization_node(state: CRMAgentState) -> dict:
    analytics = state.get("analytics_report", {})
    plan = state.get("campaign_plan", {})

    post_progress(state["session_id"], "optimization", "Generating optimization recommendations...", step="optimize")

    # RAG: get historical benchmarks
    query = f"{plan.get('goal', 're-engage')} {plan.get('channel_preference', 'whatsapp')} campaign results"
    historical_raw = search_past_campaigns.invoke(query)
    try:
        historical_docs = json.loads(historical_raw) if isinstance(historical_raw, str) else historical_raw
        historical_context = "\n---\n".join([d.get("content", "") for d in historical_docs[:3]])
    except Exception:
        historical_context = "No historical data available"

    llm = ChatGroq(
        model=settings.groq_model,
        groq_api_key=settings.groq_api_key,
        temperature=0.4,
    )

    chain = OPTIMIZATION_PROMPT | llm.with_structured_output(OptimizationPlan)

    metrics = analytics.get("funnel", {}) if analytics else {}

    opt_plan: OptimizationPlan = chain.invoke({
        "current_metrics": json.dumps(metrics, indent=2),
        "historical_context": historical_context,
    })

    final_summary = (
        f"Campaign complete. {metrics.get('open_rate', 0)}% open rate. "
        f"Variant {opt_plan.winning_variant} wins. "
        f"Optimal send: {opt_plan.optimal_send_hour}:00. "
        f"{opt_plan.summary}"
    )

    post_progress(
        state["session_id"],
        "optimization",
        final_summary,
        step="optimize",
        data={"optimization_plan": opt_plan.model_dump()},
    )

    return {
        "optimization_plan": opt_plan.model_dump(),
        "final_summary": final_summary,
    }
