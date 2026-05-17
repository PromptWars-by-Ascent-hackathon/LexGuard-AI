"""
LexGuard AI — FastAPI Backend
Main application entry point.
"""
import uuid, os, json
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from config import settings
from services.document_extractor import extract_text
from pipeline.orchestrator import run_pipeline

# ─── In-memory session store (replace with Firestore in production) ───────────
_sessions: dict = {}

app = FastAPI(
    title="LexGuard AI",
    description="AI-powered legal document intelligence platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DISCLAIMER = (
    "LexGuard is an AI-powered awareness tool and does not constitute legal advice. "
    "Consult a licensed attorney in your jurisdiction for legally binding guidance."
)

SUPPORTED_TYPES = {"application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
SUPPORTED_EXTS  = {".pdf", ".txt", ".docx", ".doc"}

# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "service": "LexGuard AI Backend",
        "version": "1.0.0",
        "gcp_project": settings.gcp_project_id,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

# ─── Upload & Analyze ─────────────────────────────────────────────────────────
@app.post("/api/v1/documents/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Upload a legal document and trigger the 5-agent analysis pipeline."""

    # Validate file
    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in SUPPORTED_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported: {', '.join(SUPPORTED_EXTS)}"
        )

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > settings.max_file_size_mb:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f}MB). Maximum allowed: {settings.max_file_size_mb}MB"
        )

    # Create session
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "session_id": session_id,
        "filename": file.filename,
        "status": "processing",
        "progress": {"agent": 0, "message": "Document received, starting analysis..."},
        "created_at": datetime.utcnow().isoformat() + "Z",
        "result": None,
        "error": None
    }

    # Extract text
    try:
        document_text = await extract_text(content, file.filename or "document.txt")
    except Exception as e:
        _sessions[session_id]["status"] = "error"
        _sessions[session_id]["error"] = str(e)
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {e}")

    # Run pipeline in background
    background_tasks.add_task(_run_pipeline_task, session_id, document_text, file.filename or "document")

    return {
        "session_id": session_id,
        "filename": file.filename,
        "file_size_mb": round(size_mb, 2),
        "status": "processing",
        "message": "Document received. Analysis pipeline started.",
        "disclaimer": DISCLAIMER
    }

async def _run_pipeline_task(session_id: str, document_text: str, filename: str):
    """Background task that runs the full pipeline and stores results."""

    async def progress_cb(agent_num: int, msg: str):
        if session_id in _sessions:
            _sessions[session_id]["progress"] = {"agent": agent_num, "message": msg}

    try:
        result = await run_pipeline(document_text, session_id, filename, progress_cb)
        _sessions[session_id]["status"] = "completed"
        _sessions[session_id]["result"] = result
        _sessions[session_id]["progress"] = {"agent": 5, "message": "Analysis complete!"}
    except Exception as e:
        _sessions[session_id]["status"] = "error"
        _sessions[session_id]["error"] = str(e)
        _sessions[session_id]["progress"] = {"agent": -1, "message": f"Error: {e}"}

# ─── Analysis Status ──────────────────────────────────────────────────────────
@app.get("/api/v1/analysis/{session_id}/status")
async def get_status(session_id: str):
    """Get the current pipeline processing status."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "status": session["status"],
        "progress": session["progress"],
        "filename": session.get("filename"),
        "created_at": session.get("created_at")
    }

# ─── Get Analysis Results ─────────────────────────────────────────────────────
@app.get("/api/v1/analysis/{session_id}")
async def get_analysis(session_id: str):
    """Get complete analysis results for a session."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["status"] == "processing":
        return JSONResponse(
            status_code=202,
            content={
                "session_id": session_id,
                "status": "processing",
                "progress": session["progress"],
                "message": "Analysis in progress. Please poll again."
            }
        )

    if session["status"] == "error":
        raise HTTPException(status_code=500, detail=session.get("error", "Pipeline error"))

    return session["result"]

# ─── List Sessions (Dashboard) ────────────────────────────────────────────────
@app.get("/api/v1/sessions")
async def list_sessions():
    """List all analysis sessions for dashboard."""
    sessions_summary = []
    for sid, s in _sessions.items():
        summary = {
            "session_id": sid,
            "filename": s.get("filename"),
            "status": s.get("status"),
            "created_at": s.get("created_at")
        }
        if s.get("result"):
            r = s["result"]
            summary["document_type"] = r.get("document_type")
            summary["overall_risk_score"] = r.get("overall_risk_score")
            summary["clause_counts"] = r.get("clause_counts")
        sessions_summary.append(summary)

    sessions_summary.sort(key=lambda x: x.get("created_at",""), reverse=True)
    return {"sessions": sessions_summary, "total": len(sessions_summary)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
