"""
Seed Qdrant with initial campaign performance data, brand voice corpus,
and segment profiles so RAG has rich context from the first run.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../ai-service"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../../ai-service/.env"))

from app.rag.ingestion import ingest_documents

# ── Brand Voice Corpus ─────────────────────────────────────────────────────────
BRAND_VOICE = [
    """Zari Brand Voice Guide — Tone: Warm, aspirational, personal. We celebrate the beauty of Indian fashion
    with a modern sensibility. Our messaging feels like a recommendation from a trusted friend who has excellent taste.
    We never use corporate jargon. We use simple, direct language. Light use of Hindi words is encouraged when natural
    (e.g., 'naya collection', 'khushiyan'). Emoji use: 1-2 per message max, only when it adds warmth.
    We always address the customer by first name when possible.""",

    """Zari Copy Style — WhatsApp & SMS: Short, punchy, conversational. Max 160 chars. Start with the customer's name.
    Lead with the hook or offer. End with a clear CTA. Example: "Priya, your kurtas miss you! 🌸 Get 20% off your next
    Ethnic Wear order. Shop now → [link]" """,

    """Zari Copy Style — Email: Warmer, more storytelling. Subject line should be curiosity-inducing.
    Open with a personal touch. 2-3 short paragraphs. Always include a clear primary CTA button.
    Subject line examples: "A little something for you, Ananya", "Your next favourite piece is waiting",
    "We picked something special for you" """,

    """Zari Campaign Goals: Re-engage (lapsed customers, offer 15-20% discount, reference their last purchase),
    Loyalty (reward repeat buyers, early access, surprise gifts), Upsell (recommend complementary or premium items
    based on purchase history), New arrivals (announce, create FOMO, limited collection).
    Always tie the message to the customer's taste and history.""",
]

# ── High-Performing Past Campaigns ─────────────────────────────────────────────
CAMPAIGN_PERFORMANCE = [
    """Campaign: Diwali Re-engagement 2024. Goal: re-engage. Channel: whatsapp.
    Audience: Customers inactive for 90+ days, had purchased Ethnic Wear. Size: 1200.
    Copy: "Happy Diwali, {{first_name}}! 🪔 We have a sparkly surprise for you — 20% off our Festive Edit.
    Your last Lehenga from us was stunning. See what's new → [link]"
    Results: 67% open rate, 28% CTR, 11% conversion. Sent at 7 PM IST.
    Key learning: Festive timing + personal reference to last purchase drove highest CTR in 2024.""",

    """Campaign: VIP Loyalty Reward Q3 2024. Goal: loyalty. Channel: email.
    Audience: VIP customers (LTV > 15000), loyal tag. Size: 340.
    Subject: "You deserve this, {{first_name}} 💎"
    Body: "As one of our most valued Zari family members, we wanted to give you early access to our
    Winter Luxe Collection — 24 hours before it goes live. Plus, a complimentary gift on orders above ₹5000."
    Results: 72% open rate, 35% CTR, 18% conversion.
    Key learning: Exclusivity framing + early access for VIPs outperforms discount offers.""",

    """Campaign: New Arrivals — Kurta Summer Edit 2024. Goal: announce. Channel: whatsapp.
    Audience: Customers with Kurtas in top_categories. Size: 890.
    Copy: "{{first_name}}, summer just got more colourful! ☀️ Our new Block Print Kurta Edit is live.
    12 new styles, just restocked. Shop before they go → [link]"
    Results: 58% open rate, 22% CTR, 9% conversion.
    Key learning: Category-specific announcements with scarcity (restocked/limited) perform 30% better than generic.""",

    """Campaign: Winback 120-day Lapsed. Goal: winback. Channel: sms.
    Audience: Not purchased in 120+ days, one-time tag. Size: 520.
    Copy: "{{first_name}}, we miss you at Zari! Here's 25% off — just for you. ZARI25 valid 48hrs. Shop → [link]"
    Results: 41% open rate, 19% CTR, 7% conversion.
    Key learning: SMS winback with 48hr urgency and higher discount (25%) outperforms email for lapsed segments.""",

    """Campaign: Upsell — Accessory Add-on. Goal: upsell. Channel: whatsapp.
    Audience: Purchased Sarees or Lehengas in last 30 days. Size: 380.
    Copy: "Your {{last_purchase_category}} deserves the perfect finish, {{first_name}} ✨
    Complete the look with our Oxidised Jewellery Edit — 15% off today only."
    Results: 64% open rate, 31% CTR, 14% conversion.
    Key learning: Upsell tied to recent purchase category achieves highest CTR of all upsell campaigns.""",

    """Campaign: At-Risk Loyalty Save. Goal: re-engage. Channel: email.
    Audience: Customers with loyal tag but no purchase in 60+ days. Size: 210.
    Subject: "{{first_name}}, is everything okay? 💙"
    Body: "We noticed you haven't visited Zari in a while. We hope everything's well.
    We've kept something aside just for you — your loyal member discount: 20% off + free shipping."
    Results: 69% open rate, 29% CTR, 13% conversion.
    Key learning: Empathetic subject line for loyal customers achieves 20% higher open rate than standard offer subject.""",
]

# ── Customer Segment Profiles ──────────────────────────────────────────────────
SEGMENT_PROFILES = [
    """Segment: Lapsed 90-day customers with WhatsApp preference.
    Criteria: last_purchase_at >= 90 days ago, channel_preferences.whatsapp = true.
    Typical size: 400-800. Avg LTV: ₹6500. Top categories: Ethnic Wear, Kurtas.
    MongoDB pipeline: [{$match: {last_purchase_at: {$lte: cutoff_90d}, channel_preferences.whatsapp: true}}]
    Best campaign type: Re-engagement with discount offer.""",

    """Segment: VIP High-Value customers.
    Criteria: ltv > 15000, tags contains 'vip' or total_orders >= 10.
    Typical size: 50-200. Avg LTV: ₹28000. Top categories: Sarees, Lehengas, Accessories.
    MongoDB pipeline: [{$match: {ltv: {$gte: 15000}}}]
    Best campaign type: Loyalty reward, early access, exclusive offers.""",

    """Segment: At-Risk customers (churning signal).
    Criteria: last_purchase_at 60-90 days ago, churn_score > 0.5.
    Typical size: 200-500. Avg LTV: ₹4500.
    MongoDB pipeline: [{$match: {churn_score: {$gte: 0.5}, last_purchase_at: {$lte: cutoff_60d, $gte: cutoff_90d}}}]
    Best campaign type: Re-engage with strong discount, create urgency.""",

    """Segment: Recent buyers — cross-sell opportunity.
    Criteria: last_purchase_at within 30 days, total_orders >= 2.
    Typical size: 150-400. Avg LTV: ₹8000.
    MongoDB pipeline: [{$match: {last_purchase_at: {$gte: cutoff_30d}, total_orders: {$gte: 2}}}]
    Best campaign type: Upsell with complementary product recommendation.""",

    """Segment: New customers — first purchase follow-up.
    Criteria: total_orders == 1, created_at within 45 days.
    Typical size: 100-300. LTV: ₹1500-3000 (early stage).
    MongoDB pipeline: [{$match: {total_orders: 1, created_at: {$gte: cutoff_45d}}}]
    Best campaign type: Loyalty programme onboarding, second purchase incentive.""",
]

# ── Message Templates ──────────────────────────────────────────────────────────
MESSAGE_TEMPLATES = [
    """Template: Re-engagement WhatsApp. Goal: re-engage. Channel: whatsapp. Open rate: 65%.
    "{{first_name}}, we've been thinking of you! 🌸 It's been a while since your last {{last_purchase_category}} order.
    Your exclusive 20% off is waiting → [link]. Use code {{promo_code}} valid 48hrs." """,

    """Template: Loyalty Reward Email. Goal: loyalty. Channel: email. Open rate: 71%.
    Subject: "Something special for you, {{first_name}}"
    "Hi {{first_name}}, thank you for being a Zari loyalist. As a thank you, here's early access to our new
    {{recommended_product}} collection + 15% off. This offer is just for you. Shop now → [link]" """,

    """Template: Upsell WhatsApp. Goal: upsell. Channel: whatsapp. CTR: 30%.
    "{{first_name}}, your {{last_purchase_category}} deserves a perfect match ✨
    Check out {{recommended_product}} — curated just for your style. 15% off today: {{promo_code}} → [link]" """,

    """Template: Winback SMS. Goal: winback. Channel: sms. Conversion: 8%.
    "{{first_name}} we miss u! 25% off just for u. {{promo_code}} exp 24hrs. Shop → [link]" """,
]


def main():
    print("Seeding Qdrant collections...")

    print("  → brand_voice_corpus...")
    ingest_documents("brand_voice_corpus", BRAND_VOICE)

    print("  → campaign_performance...")
    ingest_documents(
        "campaign_performance",
        CAMPAIGN_PERFORMANCE,
        [{"type": "campaign_record"} for _ in CAMPAIGN_PERFORMANCE],
    )

    print("  → customer_segment_profiles...")
    ingest_documents(
        "customer_segment_profiles",
        SEGMENT_PROFILES,
        [{"type": "segment_profile"} for _ in SEGMENT_PROFILES],
    )

    print("  → message_templates...")
    ingest_documents(
        "message_templates",
        MESSAGE_TEMPLATES,
        [{"type": "template"} for _ in MESSAGE_TEMPLATES],
    )

    print("Qdrant seeding complete.")


if __name__ == "__main__":
    main()
