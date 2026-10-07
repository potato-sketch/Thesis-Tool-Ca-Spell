from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from error_correction.corrector import correct_errors
from error_correction.final_scoring import scoring_weights
from error_detection.detector import detect_errors
from preprocessing.pipeline import lexicon, preprocess, preprocess_many, token_features


app = FastAPI(title="Ca-Spell API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["POST"],
    allow_headers=["*"],
)


class CheckRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


@app.get("/api/health")
def health():
    return {"status": "ok", "lexicon": lexicon.stats()}


@app.post("/api/check")
def check_text(request: CheckRequest):
    doc = preprocess(request.text)
    detections, errors = detect_errors(doc, lexicon)
    suggestions = correct_errors(doc, detections, errors, lexicon, preprocess_many)
    return {
        "tokens": [{**token_features(token), **detections[token.i]} for token in doc],
        "errors": [{**error, "suggestions": suggestions.get(error["index"], [])} for error in errors],
        "weights": scoring_weights(),
    }
