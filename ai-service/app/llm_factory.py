from langchain_groq import ChatGroq
from app.config import settings

import os

GROQ_KEYS = [
    settings.groq_api_key,
]
if os.environ.get("GROQ_API_KEY_FALLBACK"):
    GROQ_KEYS.append(os.environ.get("GROQ_API_KEY_FALLBACK"))

def get_llm(temperature=0.0, model=None, tools=None):
    """
    Returns a ChatGroq LLM that automatically falls back to secondary API keys if a rate limit or error occurs.
    """
    model_name = model or settings.groq_model
    
    primary = ChatGroq(
        model=model_name, 
        groq_api_key=GROQ_KEYS[0], 
        temperature=temperature
    )
    
    fallbacks = [
        ChatGroq(model=model_name, groq_api_key=k, temperature=temperature) 
        for k in GROQ_KEYS[1:]
    ]
    
    if tools:
        primary = primary.bind_tools(tools)
        fallbacks = [f.bind_tools(tools) for f in fallbacks]
    
    if fallbacks:
        return primary.with_fallbacks(fallbacks)
        
    return primary
