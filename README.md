
# Finance Agent

A voice-based AI agent for real-time financial conversation, powered by LiveKit, Cartesia, Deepgram, and Groq.

## 🔧 Setup Instructions

### 1. Create `.env` in the project root:
```env
# API KEYS
DEEPGRAM_API_KEY=
CARTESIA_API_KEY=
GROQ_API_KEY=

# LIVEKIT CLOUD
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
````

### 2. Install dependencies

```bash
# Backend
cd agent
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 3. Run the App (use 3 terminals)

**Terminal 1:**

```bash
cd agent
python agent.py connect -room my-room
```

**Terminal 2:**

```bash
cd agent
python app.py
```

**Terminal 3:**

```bash
cd frontend
npm run start
```

---

## 📁 Project Structure

* `agent/` – Backend logic for voice interaction and financial processing
* `frontend/` – React frontend for user interaction

## 🛠️ Tech Stack

* LiveKit (Voice & Room)
* Deepgram (Speech-to-Text)
* Cartesia (RAG / Reasoning)
* Groq (LLM inference)
* React (Frontend)


