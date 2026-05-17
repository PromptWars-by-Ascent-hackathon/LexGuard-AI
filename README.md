# LexGuard AI — Contract Intelligence Platform

> **Know what you sign. Before you sign it.**

LexGuard is an AI-powered legal document analysis platform that runs uploaded contracts, NDAs, employment agreements, and SaaS terms through a **5-agent pipeline** powered by Google Gemini. It extracts every clause, classifies its risk level, provides deep legal reasoning, generates plain-English explanations, and produces a complete negotiation strategy — in minutes.

[![Tests](https://github.com/Ndheeraj906/LexGuard-AI/actions/workflows/test.yml/badge.svg)](https://github.com/Ndheeraj906/LexGuard-AI/actions/workflows/test.yml)

---

## 🎯 Vertical: Legal AI

Legal documents are deliberately dense, asymmetric, and written to favor the drafting party. Most people sign contracts without understanding what they agree to. LexGuard democratizes access to legal awareness by using AI to:
- Surface hidden risks and one-sided clauses
- Explain legal language in plain English
- Draft redlines and negotiation strategies
- Support multilingual documents via translation

---

## 🧠 How It Works — Step by Step

```
User uploads PDF / DOCX / TXT
         │
         ▼
┌─────────────────────────────────┐
│  Google Translate API           │  ← Detects language, translates to EN
│  Google NL API                  │  ← Extracts parties, dates, entities
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Agent 1 — Extractor            │  ← Segments document into clauses
│  (Gemini 2.5 Flash)             │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Agent 2 — Classifier           │  ← Assigns severity + risk dimension
│  (Gemini 2.5 Flash)             │     CRITICAL / HIGH / MEDIUM / LOW
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Agent 3 — Legal Reasoner       │  ← Deep 7-step legal analysis on
│  (Gemini 2.5 Flash)             │     high-risk clauses only
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Agent 4 — Explainer            │  ← Plain-English cards per clause
│  (Gemini 2.5 Flash)             │     Practical impact + worst-case
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Agent 5 — Negotiation Advisor  │  ← Redlines, email template,
│  (Gemini 2.5 Flash)             │     walk-away triggers
└─────────────────────────────────┘
         │
         ▼
  Risk Score + Full Analysis Result
  Displayed in React Dashboard
```

### Risk Scoring Algorithm
The overall risk score prevents the "averaging trap" where a single CRITICAL clause gets diluted by many boilerplate LOW clauses:

```
overall = max(clause_scores) + 0.10 × sum(remaining_scores)
```
All scores are capped at 100. A document with one CRITICAL clause will always score high.

---

## 🔧 Google Services Used

| Service | Module | Legal Use Case |
|---|---|---|
| **Google Gemini 2.5 Flash** | `src/services/googleGemini.js` | All 5 agents — clause extraction, risk classification, legal reasoning, plain-English explanation, negotiation strategy |
| **Google Cloud Natural Language API** | `src/services/googleNaturalLanguage.js` | Extracts named entities (parties, organizations, dates, monetary values) from contract text for structured metadata |
| **Google Cloud Translate API** | `src/services/googleTranslate.js` | Detects document language; translates non-English contracts to English before pipeline processing, enabling multilingual support |

---

## 📁 Repository Structure

```
LexGuard-AI/
├── backend-node/              ← Node.js/Express backend (active)
│   ├── src/
│   │   ├── index.js           ← Express server (helmet, rate limiting, routes)
│   │   ├── agents.js          ← 5-agent Gemini pipeline
│   │   ├── pipeline.js        ← Orchestrator & session manager
│   │   ├── services/
│   │   │   ├── googleGemini.js        ← Gemini API + TTL cache
│   │   │   ├── googleNaturalLanguage.js ← NL entity extraction
│   │   │   └── googleTranslate.js     ← Language detection + translation
│   │   ├── utils/
│   │   │   ├── riskScoring.js         ← Risk score algorithm
│   │   │   └── documentParser.js      ← PDF/DOCX/TXT text extraction
│   │   └── tests/
│   │       ├── unit.test.js           ← Unit tests (node:test)
│   │       └── integration.test.js    ← Integration tests
│   ├── Dockerfile             ← Cloud Run deployment
│   ├── .env.example           ← Environment variable template
│   ├── eslint.config.js       ← ESLint configuration
│   └── .prettierrc            ← Prettier formatting
├── frontend/                  ← React/Vite frontend
│   └── src/
│       ├── components/        ← Navbar, ClauseCard, DocumentUploader, RiskComponents
│       ├── pages/             ← Dashboard, AnalysisPage
│       └── services/api.js    ← API client
├── .github/
│   └── workflows/test.yml     ← CI: runs tests on every push
├── .gitignore                 ← Excludes .env, node_modules, secrets
└── README.md
```

---

## ⚙️ Setup Instructions

### Prerequisites
- Node.js ≥ 20
- A Google Gemini API key (same key works for NL API + Translate API on the same GCP project)

### 1. Clone the repository
```bash
git clone https://github.com/Ndheeraj906/LexGuard-AI.git
cd LexGuard-AI
```

### 2. Configure the backend
```bash
cd backend-node
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 3. Install & start backend
```bash
npm install
npm start
# Backend runs at http://localhost:8000
```

### 4. Install & start frontend
```bash
cd ../frontend
npm install
npm run dev
# Frontend runs at http://localhost:5173
```

### 5. Run tests
```bash
cd backend-node
npm test          # Unit tests only
```

---

## 🌐 Production Deployment (Google Cloud Run)

```bash
cd backend-node

# Build & push Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT/lexguard-backend

# Deploy to Cloud Run
gcloud run deploy lexguard-backend \
  --image gcr.io/YOUR_PROJECT/lexguard-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key_here,GCP_PROJECT_ID=YOUR_PROJECT \
  --memory 1Gi \
  --timeout 300
```

---

## 🔐 Security

- All API keys stored in `.env` — never committed to git
- `.env` and `node_modules/` excluded via `.gitignore`
- Rate limiting: 10 uploads/min per IP, 60 API calls/min per IP
- Helmet.js security headers on all responses
- Input sanitization: file type validation, size limits, null-byte stripping
- UUID format validation on session ID parameters

---

## ⚠️ Assumptions & Limitations

1. **Not legal advice** — LexGuard is an awareness tool. Always consult a licensed attorney for binding legal guidance.
2. **Free-tier API quotas** — Gemini free tier allows 20 requests/day for Gemini 2.5 Flash. Upgrade for production use.
3. **English-optimized pipeline** — The legal reasoning agents are tuned for English legal text. The Translate API handles non-English input, but accuracy may vary for complex jurisdictional terms.
4. **In-memory sessions** — Sessions are stored in RAM and reset on server restart. Add Redis or Firestore for persistence.
5. **File size** — Maximum 10MB per upload. Very long contracts (200+ pages) may be truncated at 40,000 characters for the extraction agent.

---

## 📄 License

MIT — See [LICENSE](./LICENSE) for details.

> ⚠️ LexGuard is an AI-powered awareness tool and does not constitute legal advice. Consult a licensed attorney in your jurisdiction for legally binding guidance.
