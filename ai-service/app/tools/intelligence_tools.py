import json
from langchain_groq import ChatGroq
from app.config import settings
from app.tools.mongo_tools import get_db

def suggest_campaign_ideas(context: str) -> dict:
    """Analyze context and return 3 campaign ideas."""
    llm = ChatGroq(model=settings.groq_model, groq_api_key=settings.groq_api_key, temperature=0.7)
    prompt = f"""You are an AI marketing strategist for Zari Fashion.
    Based on this business context: "{context}", suggest exactly 3 creative campaign ideas.
    Return JSON format: {{"campaigns": [{{"name": "...", "audience": "...", "offer": "...", "reasoning": "..."}}]}}"""
    
    response = llm.invoke(prompt)
    content = response.content.strip()
    if content.startswith("```json"):
        content = content.split("```json")[1].split("```")[0].strip()
    elif content.startswith("```"):
        content = content.split("```")[1].split("```")[0].strip()
        
    try:
        return json.loads(content)
    except Exception:
        return {"campaigns": []}

def estimate_segment_size(nl_criteria: str) -> dict:
    """Estimate segment size from NL criteria."""
    from app.graph.nodes.segmentation import PIPELINE_PROMPT, SegmentPipeline
    llm = ChatGroq(model=settings.groq_model, groq_api_key=settings.groq_api_key, temperature=0.0)
    chain = PIPELINE_PROMPT | llm.with_structured_output(SegmentPipeline)
    try:
        plan_result = chain.invoke({"criteria": nl_criteria, "channel": "any", "rag_context": ""})
        pipeline = plan_result.stages
    except Exception:
        return {"size": 0, "error": "Failed to generate pipeline"}
        
    try:
        db = get_db()
        # Add limit to avoid fetching too much just for preview
        pipeline.append({"$count": "total"})
        result = list(db.customers.aggregate(pipeline))
        size = result[0]["total"] if result else 0
        return {"size": size, "name": plan_result.segment_name, "description": plan_result.segment_description}
    except Exception as e:
        return {"size": 0, "error": str(e)}

def preview_message(goal: str, channel: str, audience_desc: str) -> dict:
    """Generate a sample message preview."""
    from app.prompts.campaign_creation_prompt import CAMPAIGN_CREATION_PROMPT
    from app.models.campaign import CampaignCopy
    llm = ChatGroq(model=settings.groq_model, groq_api_key=settings.groq_api_key, temperature=0.4)
    chain = CAMPAIGN_CREATION_PROMPT | llm.with_structured_output(CampaignCopy)
    try:
        copy = chain.invoke({
            "goal": goal,
            "channel": channel,
            "segment_description": audience_desc,
            "segment_size": "a large group of",
            "offer": "relevant offer",
            "rag_context": "",
            "brand_voice": ""
        })
        return copy.model_dump()
    except Exception as e:
        return {"error": str(e)}

def get_customer_health_score() -> dict:
    """Return CRM health summary."""
    try:
        db = get_db()
        total = db.customers.count_documents({})
        vip = db.customers.count_documents({"tags": "vip"})
        churned = db.customers.count_documents({"tags": "churned"})
        return {
            "health_score": max(0, 100 - (churned / max(total, 1)) * 100),
            "total_customers": total,
            "vip_count": vip,
            "churned_count": churned
        }
    except Exception:
        return {}
