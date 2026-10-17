from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from error_correction.corrector import correct_errors
from error_correction.final_scoring import scoring_weights
from error_correction.frequency_profile import FrequencyProfile
from error_detection.detector import detect_errors
from preprocessing.pipeline import lexicon, preprocess, preprocess_many, token_features


app = FastAPI(title="Ca-Spell API")

# None until backend/scripts/build_corpus_profile.py has built it from the Correct Taglish Corpus.
corpus_profile = FrequencyProfile.load()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"(https?://(localhost|127\.0\.0\.1)(:\d+)?|(chrome|moz)-extension://[\w-]+)",
    allow_methods=["POST"],
    allow_headers=["*"],
)


class CheckRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)


class SuggestRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    start: int = Field(ge=0)
    end: int = Field(gt=0)


@app.get("/api/health")
def health():
    return {"status": "ok", "lexicon": lexicon.stats(), "corpus_sentences": corpus_profile.sentences if corpus_profile else 0}


# Finding suggestions is by far the slowest step (it ranks every candidate in context), so the
# live checker asks for the misspelled words first (/api/detect) and for suggestions only for the
# one word the user clicks (/api/suggest).
@app.post("/api/detect")
def detect_text(request: CheckRequest):
    doc = preprocess(request.text)
    _, errors = detect_errors(doc, lexicon)
    return {"errors": errors}


@app.post("/api/suggest")
def suggest_for_word(request: SuggestRequest):
    doc = preprocess(request.text)
    detections, errors = detect_errors(doc, lexicon)
    target = [error for error in errors if error["start"] == request.start and error["end"] == request.end]
    if not target:
        return {"suggestions": []}
    suggestions = correct_errors(doc, detections, target, lexicon, preprocess_many, profile=corpus_profile)
    return {"suggestions": suggestions.get(target[0]["index"], [])}


@app.post("/api/check")
def check_text(request: CheckRequest):
    doc = preprocess(request.text)
    detections, errors = detect_errors(doc, lexicon)
    suggestions = correct_errors(doc, detections, errors, lexicon, preprocess_many, profile=corpus_profile)
    return {
        "tokens": [{**token_features(token), **detections[token.i]} for token in doc],
        "errors": [{**error, "suggestions": suggestions.get(error["index"], [])} for error in errors],
        "weights": scoring_weights(corpus_profile is not None),
    }


# Serve the built front-end (npm run build) so the desktop hotkey helper can open it at http://127.0.0.1:8000/.
_dist = Path(__file__).resolve().parent.parent / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="web")
