import os
from openai import AsyncOpenAI 
from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import (
    openai as livekit_openai,
    cartesia,
    deepgram,
    noise_cancellation,
    silero,
)
from livekit.plugins.turn_detector.multilingual import MultilingualModel
import openai as openai_sdk

load_dotenv()

class FinancialAdvisorAssistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are FinanceBot, an expert financial advisor AI assistant. 

Your specialty is helping people with:
- Loan and mortgage calculations
- Investment and retirement planning 
- Budget analysis and financial advice
- Explaining complex financial concepts simply

When users ask for loan calculations, use this format:
"I'll calculate that for you. For a loan of $X at Y% for Z years..."

Always be professional and emphasize that advice is for informational purposes."""
        )

def calculate_loan_payment(principal: float, annual_rate: float, years: int) -> str:
    """Calculate monthly loan payment - simple function"""
    monthly_rate = annual_rate / 100 / 12
    num_payments = years * 12
    
    if monthly_rate == 0:
        monthly_payment = principal / num_payments
    else:
        monthly_payment = principal * (monthly_rate * (1 + monthly_rate)**num_payments) / ((1 + monthly_rate)**num_payments - 1)
    
    total_payment = monthly_payment * num_payments
    total_interest = total_payment - principal
    
    return f"""Loan Payment Calculation:
• Principal: ${principal:,.2f}
• Interest Rate: {annual_rate}% annually
• Term: {years} years
• Monthly Payment: ${monthly_payment:,.2f}
• Total Payment: ${total_payment:,.2f}
• Total Interest: ${total_interest:,.2f}"""

async def entrypoint(ctx: agents.JobContext):
    # Create OpenAI client using Groq's endpoint
    groq_client = AsyncOpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.environ.get("GROQ_API_KEY")
    )

    # Simple LLM setup without functions parameter
    llm = livekit_openai.LLM(
        model="llama-3.3-70b-versatile",
        client=groq_client,
    )

    # Set up the agent session
    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="multi"),
        llm=llm,
        tts=cartesia.TTS(
            model="sonic-2",
            voice="f786b574-daa5-4673-aa0c-cbe3e8534c02"
        ),
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    await ctx.connect()

    await session.start(
        room=ctx.room,
        agent=FinancialAdvisorAssistant(),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    # Initial greeting
    await session.generate_reply(
        instructions="""Greet the user as FinanceBot and say: 
        'Hello! I'm FinanceBot, your personal financial advisor AI. I can help you with loan calculations, investment planning, and budgeting advice. What financial question can I help you with today?'"""
    )

if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(entrypoint_fnc=entrypoint)
    )