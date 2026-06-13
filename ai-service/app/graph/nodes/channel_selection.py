import json
from app.graph.state import CRMAgentState
from app.tools.mongo_tools import get_customer_engagement_history, get_customer_profile
from app.tools.persona_tools import get_channel_affinity
from app.utils.callbacks import post_progress

CHANNEL_PRIORITY = ["whatsapp", "sms", "email", "rcs"]


def select_channel_for_customer(customer_id: str, preferred_channel: str, persona_send_hour: int = None) -> dict:
    # 1. AI Channel Affinity — highest signal, use when channel is "auto"
    if not preferred_channel or preferred_channel == "auto":
        try:
            affinity_raw = get_channel_affinity.invoke(customer_id)
            affinity = json.loads(affinity_raw)
            if affinity.get("found"):
                best_ch = affinity["best_channel"]
                best_score = affinity.get(best_ch, 0.5)
                send_hour = persona_send_hour or affinity.get("best_send_hour", 19)
                return {
                    "customer_id": customer_id,
                    "channel": best_ch,
                    "confidence_score": round(min(best_score, 0.99), 2),
                    "reason": f"AI channel affinity score {round(best_score * 100)}%",
                    "best_send_hour": send_hour,
                    "channel_affinity": {
                        "whatsapp": affinity.get("whatsapp", 0),
                        "email": affinity.get("email", 0),
                        "sms": affinity.get("sms", 0),
                    },
                }
        except Exception:
            pass

    # 2. Campaign-specified channel — validate opt-in then use it
    if preferred_channel and preferred_channel != "auto":
        profile_raw = get_customer_profile.invoke(customer_id)
        try:
            profile = json.loads(profile_raw)
            prefs = profile.get("channel_preferences", {})
            if prefs.get(preferred_channel, True):
                # still try to get affinity scores for metadata
                affinity_scores = {}
                try:
                    af = json.loads(get_channel_affinity.invoke(customer_id))
                    affinity_scores = {"whatsapp": af.get("whatsapp", 0), "email": af.get("email", 0), "sms": af.get("sms", 0)}
                    send_hour = persona_send_hour or af.get("best_send_hour", 19)
                except Exception:
                    send_hour = persona_send_hour or 19
                return {
                    "customer_id": customer_id,
                    "channel": preferred_channel,
                    "confidence_score": 0.85,
                    "reason": "campaign channel preference",
                    "best_send_hour": send_hour,
                    "channel_affinity": affinity_scores,
                }
        except Exception:
            pass

    # 3. Historical engagement history
    history_raw = get_customer_engagement_history.invoke(customer_id)
    try:
        history = json.loads(history_raw)
        if history:
            best = max(history.items(), key=lambda x: x[1].get("open_rate", 0))
            channel, stats = best
            return {
                "customer_id": customer_id,
                "channel": channel,
                "confidence_score": round(min(stats["open_rate"] / 100, 0.99), 2),
                "reason": f"historical open rate {stats['open_rate']}%",
                "best_send_hour": persona_send_hour or 19,
            }
    except Exception:
        pass

    # 4. Customer opt-in preferences fallback
    try:
        profile = json.loads(get_customer_profile.invoke(customer_id))
        prefs = profile.get("channel_preferences", {})
        for ch in CHANNEL_PRIORITY:
            if prefs.get(ch, False):
                return {
                    "customer_id": customer_id,
                    "channel": ch,
                    "confidence_score": 0.7,
                    "reason": "customer opt-in preference",
                    "best_send_hour": persona_send_hour or 19,
                }
    except Exception:
        pass

    return {
        "customer_id": customer_id,
        "channel": "email",
        "confidence_score": 0.5,
        "reason": "default fallback",
        "best_send_hour": persona_send_hour or 19,
    }


def channel_selection_node(state: CRMAgentState) -> dict:
    messages = state.get("personalized_messages", [])
    plan = state.get("campaign_plan", {})
    preferred_channel = plan.get("channel_preference", "auto")

    if not messages:
        return {"channel_assignments": [], "current_step": "execute"}

    post_progress(
        state["session_id"],
        "channel_selection",
        f"Assigning channels + best send times to {len(messages)} customers...",
        step="select_channel",
    )

    assignments = []
    for msg in messages:
        cid = msg.get("customer_id")
        if cid:
            # pass persona best_send_hour from personalization step
            persona_hour = msg.get("best_send_hour") if msg.get("best_send_hour") != 19 else None
            assignment = select_channel_for_customer(cid, preferred_channel, persona_send_hour=persona_hour)
            assignments.append(assignment)

    channel_counts = {}
    for a in assignments:
        ch = a["channel"]
        channel_counts[ch] = channel_counts.get(ch, 0) + 1

    summary = ", ".join([f"{ch}: {cnt}" for ch, cnt in channel_counts.items()])
    
    # Calculate predicted metrics
    avg_confidence = sum([a.get("confidence_score", 0.5) for a in assignments]) / max(len(assignments), 1)
    # Heuristics for prediction based on channel mix and confidence
    base_open = 0
    base_click = 0
    base_conv = 0
    
    for ch, count in channel_counts.items():
        weight = count / len(assignments)
        if ch == "whatsapp":
            base_open += 65.0 * weight
            base_click += 25.0 * weight
            base_conv += 8.0 * weight
        elif ch == "email":
            base_open += 22.0 * weight
            base_click += 4.5 * weight
            base_conv += 1.2 * weight
        elif ch == "sms":
            base_open += 85.0 * weight
            base_click += 12.0 * weight
            base_conv += 3.5 * weight
        else:
            base_open += 30.0 * weight
            base_click += 10.0 * weight
            base_conv += 2.0 * weight
            
    # Scale by confidence score (0.5 to 1.0 mapping roughly to 0.8x to 1.2x multiplier)
    multiplier = 0.8 + (avg_confidence - 0.5) * 0.8
    
    predicted_metrics = {
        "open_rate": round(base_open * multiplier, 1),
        "ctr": round(base_click * multiplier, 1),
        "conversion_rate": round(base_conv * multiplier, 1)
    }
    
    post_progress(
        state["session_id"],
        "channel_selection",
        f"Channel assignments: {summary}. Predicted Open Rate: {predicted_metrics['open_rate']}%",
        step="select_channel",
        data={"channel_breakdown": channel_counts, "predicted_metrics": predicted_metrics},
    )

    # Pass predicted metrics to state so human_approval can see it
    state["context"] = state.get("context", {})
    state["context"]["predicted_metrics"] = predicted_metrics

    return {
        "channel_assignments": assignments,
        "context": state["context"],
        "current_step": "execute",
    }
