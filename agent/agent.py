import os
import csv
from datetime import datetime
from dotenv import load_dotenv

from openai import AsyncOpenAI
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.agents import metrics, MetricsCollectedEvent
from livekit.plugins import (
    openai as livekit_openai,
    cartesia,
    deepgram,
    noise_cancellation,
    silero,
)
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv()

latest_metrics = {}

class FinancialAdvisorAssistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""
You are FinanceBot, a professional AI financial advisor. All your answers should never include signs or operators, no asterics, etc. Just use multiplied by etc

Your main responsibilities:
- If the user asks for **loan or mortgage calculations**, respond with:  
  "I'll calculate that for you. For a loan of $X at Y% for Z years..."  
  Then perform the calculation and present:
  • Monthly Payment  
  • Total Payment  
  • Total Interest

- If the user asks about **investment planning**, respond with:  
  "To plan investments, I consider goals, risk tolerance, and time horizon. Here's a basic strategy..."

- If the user asks about **retirement planning**, respond with:  
  "Retirement planning involves estimating post-retirement needs, savings goals, and contribution schedules..."

- If the user asks for **budgeting or financial advice**, respond with:  
  "Effective budgeting follows the 50/30/20 rule. Here's a simple breakdown..."

- For all answers:
  • Be concise and professional  
  • Make it clear the advice is informational, not financial counsel  
  • Use formatting like bullet points or line breaks for clarity  
  • Never ask for personal data

If the question doesn't fall into those categories, answer normally using your financial knowledge.
"""
        )


def log_latency_metrics(speech_id, eou_delay, ttft, ttfb):
    total_latency = eou_delay + ttft + ttfb
    filename = "metrics_log.csv"
    file_exists = os.path.isfile(filename)
    with open(filename, mode="a", newline="") as file:
        writer = csv.writer(file)
        if not file_exists:
            writer.writerow(["Timestamp", "Speech ID", "EOU Delay", "TTFT", "TTFB", "Total Latency"])
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            speech_id,
            f"{eou_delay:.3f}",
            f"{ttft:.3f}",
            f"{ttfb:.3f}",
            f"{total_latency:.3f}"
        ])

# ------------- Entrypoint -------------
async def entrypoint(ctx: agents.JobContext):
    groq_client = AsyncOpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=os.environ.get("GROQ_API_KEY")
    )

    llm = livekit_openai.LLM(
        model="llama-3.3-70b-versatile",
        client=groq_client,
    )

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

    # Handle metrics_collected event
    @session.on("metrics_collected")
    def on_metrics(ev: MetricsCollectedEvent):
        m = ev.metrics
        speech_id = getattr(m, "speech_id", None)
        if speech_id is None:
            return

        # Store relevant metrics
        if isinstance(m, metrics.EOUMetrics):
            latest_metrics.setdefault(speech_id, {})["eou"] = m.end_of_utterance_delay
        elif isinstance(m, metrics.LLMMetrics):
            latest_metrics.setdefault(speech_id, {})["ttft"] = m.ttft
        elif isinstance(m, metrics.TTSMetrics):
            latest_metrics.setdefault(speech_id, {})["ttfb"] = m.ttfb

        # Once we have all three, log them
        metric_set = latest_metrics.get(speech_id, {})
        if all(k in metric_set for k in ("eou", "ttft", "ttfb")):
            log_latency_metrics(
                speech_id,
                metric_set["eou"],
                metric_set["ttft"],
                metric_set["ttfb"]
            )
            del latest_metrics[speech_id]

    # Optional: usage summary at shutdown
    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def on_usage(ev: MetricsCollectedEvent):
        usage_collector.collect(ev.metrics)

    async def log_usage():
        summary = usage_collector.get_summary()
        print(f"Session Usage Summary: {summary}")

    ctx.add_shutdown_callback(log_usage)

    await ctx.connect()

    await session.start(
        room=ctx.room,
        agent=FinancialAdvisorAssistant(),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    await session.generate_reply(
        instructions="""Greet the user as FinanceBot and say: 
        'Hello! I'm FinanceBot, your personal financial advisor AI. I can help you with loan calculations, investment planning, and budgeting advice. What financial question can I help you with today?'"""
    )

from livekit.agents import Worker

async def run_agent():
    options = agents.WorkerOptions(entrypoint_fnc=entrypoint)
    worker = Worker(options)
    await worker.run()


# agent.py

# Do not run agent CLI app automatically if imported elsewhere
if __name__ == "__main__":
    agents.cli.run_app(
        agents.WorkerOptions(entrypoint_fnc=entrypoint)
    )

