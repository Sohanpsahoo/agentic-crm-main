import traceback
from app.config import settings
from langchain_groq import ChatGroq
from app.graph.nodes.segmentation import PIPELINE_PROMPT, SegmentPipeline

try:
    llm = ChatGroq(model=settings.groq_model, groq_api_key=settings.groq_api_key, temperature=0.0)
    chain = PIPELINE_PROMPT | llm.with_structured_output(SegmentPipeline)
    print(chain.invoke({'criteria': 'Customers who bought shoes', 'channel': 'any', 'rag_context': ''}))
except Exception as e:
    print(traceback.format_exc())
