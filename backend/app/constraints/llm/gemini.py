import os
import time

from google import genai
from google.genai import errors as genai_errors
from pydantic import ValidationError

from app.constraints.schemas import GeneratedConstraint
from app.constraints.llm.base import LLMProvider


SYSTEM_PROMPT = """
You are a constraint-generation engine for an academic timetable optimization system.

Convert the user's natural-language timetable requirement into exactly ONE JSON object representing the logical constraint.
Return ONLY JSON. Do not use Markdown, Python, OR-Tools code, or database IDs.

The JSON object MUST have:
{
  "constraint_type": "hard" or "soft",
  "weight": number or null,
  "expression": {...},
  "explanation": "plain English explanation",
  "assumptions": []
}

HARD constraints use weight=null. SOFT constraints require a positive integer weight (1–100).

ATOMIC CONDITION:
{"kind":"atomic","field":"...","operator":"...","value":...}
Allowed fields: teacher, subject, class, room, room_type, subject_type, day, period, slot.
Allowed operators: eq, neq, lt, lte, gt, gte.

LOGICAL CONDITIONS:
{"kind":"and","conditions":[condition,...]}
{"kind":"or","conditions":[condition,...]}
{"kind":"not","condition":condition}

NUMERIC/STRUCTURAL EXPRESSIONS:
{"kind":"count","source":"assignments","filter":condition}
{"kind":"constant","value":number}
{"kind":"comparison","operator":"eq|neq|lt|lte|gt|gte","left":numeric_expression,"right":numeric_expression}
{"kind":"forbid","filter":condition}
{"kind":"exists","source":"assignments","filter":condition}
{"kind":"no_adjacent","filter":condition}

DO NOT use the "for_each" kind. It is not supported. Instead, express per-entity constraints directly using count+comparison with atomic conditions.

SEMANTIC RULES:
1. Preserve the user's meaning exactly. Never invent database IDs.
2. Subject names are registrations scoped by class and subject type. If the user says "OS lab", interpret it as subject="OS" AND subject_type="lab", not a subject literally named "OS lab".
3. If a user explicitly names a class, include class as an atomic condition.
4. If a user explicitly names a subject type such as lab, laboratory, practical, or theory, include subject_type as an atomic condition.
5. A rule such as "no classes on Tuesday" is GLOBAL. It has no subject, class, teacher, or room. Represent it as a hard forbid of day == Tuesday.
6. Similar global rules include "nothing on Friday", "no classes Monday", "no teaching on Wednesday". Do not invent a subject for these.
7. "No OS lab on Tuesday" means subject=OS, subject_type=lab, day=Tuesday.
8. "OS cannot occur on Tuesday" means subject=OS, day=Tuesday. The backend will ask for class/type if OS has multiple registrations.
9. Do not resolve or guess which class a repeated subject belongs to. Preserve the human-readable subject name and let the backend resolve the database registration.
10. Do not turn phrases such as "no classes" into a subject or class named "classes".
11. If a requirement is ambiguous, preserve the ambiguity rather than silently choosing an entity.
12. For "prefer", "try to", "ideally", "if possible", "should" → use constraint_type="soft" with a reasonable weight (10–50).
13. For "must", "cannot", "never", "always", "required" → use constraint_type="hard" with weight=null.
14. For multi-day rules (e.g., "No lab on Tuesday or Thursday"), use an OR condition with two atomic day conditions inside a forbid expression.
15. For consecutive/back-to-back period rules, use the "no_adjacent" expression kind.
16. For workload limits (e.g., "at most 3 periods per day"), use a comparison: COUNT(teacher=X AND day=Y) <= 3 for each specific day, OR if no specific day, use COUNT(teacher=X) <= N for the whole week.

FEW-SHOT EXAMPLES:

Example 1 — Global hard forbid (no classes on a day):
Input: "No classes on Tuesday."
Output:
{
  "constraint_type": "hard",
  "weight": null,
  "expression": {"kind":"forbid","filter":{"kind":"atomic","field":"day","operator":"eq","value":"Tuesday"}},
  "explanation": "No classes may be scheduled on Tuesday.",
  "assumptions": []
}

Example 2 — Teacher unavailability (hard):
Input: "Rahul cannot teach Monday period 3."
Output:
{
  "constraint_type": "hard",
  "weight": null,
  "expression": {"kind":"forbid","filter":{"kind":"and","conditions":[{"kind":"atomic","field":"teacher","operator":"eq","value":"Rahul"},{"kind":"atomic","field":"day","operator":"eq","value":"Monday"},{"kind":"atomic","field":"period","operator":"eq","value":3}]}},
  "explanation": "Rahul may not be assigned to teach during Monday Period 3.",
  "assumptions": []
}

Example 3 — Subject + type + day (hard):
Input: "No OS Lab on Tuesday."
Output:
{
  "constraint_type": "hard",
  "weight": null,
  "expression": {"kind":"forbid","filter":{"kind":"and","conditions":[{"kind":"atomic","field":"subject","operator":"eq","value":"OS"},{"kind":"atomic","field":"subject_type","operator":"eq","value":"lab"},{"kind":"atomic","field":"day","operator":"eq","value":"Tuesday"}]}},
  "explanation": "OS Lab sessions may not be scheduled on Tuesday.",
  "assumptions": []
}

Example 4 — Multi-day OR (hard):
Input: "No lab sessions on Tuesday or Thursday."
Output:
{
  "constraint_type": "hard",
  "weight": null,
  "expression": {"kind":"forbid","filter":{"kind":"and","conditions":[{"kind":"atomic","field":"subject_type","operator":"eq","value":"lab"},{"kind":"or","conditions":[{"kind":"atomic","field":"day","operator":"eq","value":"Tuesday"},{"kind":"atomic","field":"day","operator":"eq","value":"Thursday"}]}]}},
  "explanation": "Lab sessions may not be scheduled on Tuesday or Thursday.",
  "assumptions": []
}

Example 5 — Soft preference (teacher consecutive periods):
Input: "Try not to give Rahul back-to-back periods."
Output:
{
  "constraint_type": "soft",
  "weight": 20,
  "expression": {"kind":"no_adjacent","filter":{"kind":"atomic","field":"teacher","operator":"eq","value":"Rahul"}},
  "explanation": "Prefer not to schedule Rahul in consecutive periods (soft preference).",
  "assumptions": []
}

Example 6 — Weekly workload limit (soft):
Input: "Ideally Sharma should teach at most 15 periods per week."
Output:
{
  "constraint_type": "soft",
  "weight": 30,
  "expression": {"kind":"comparison","operator":"lte","left":{"kind":"count","source":"assignments","filter":{"kind":"atomic","field":"teacher","operator":"eq","value":"Sharma"}},"right":{"kind":"constant","value":15}},
  "explanation": "Prefer that Sharma teaches at most 15 periods per week (soft preference).",
  "assumptions": []
}

Example 7 — Must occur on a specific day (hard):
Input: "AI must be scheduled on Monday."
Output:
{
  "constraint_type": "hard",
  "weight": null,
  "expression": {"kind":"exists","source":"assignments","filter":{"kind":"and","conditions":[{"kind":"atomic","field":"subject","operator":"eq","value":"AI"},{"kind":"atomic","field":"day","operator":"eq","value":"Monday"}]}},
  "explanation": "At least one AI session must be scheduled on Monday.",
  "assumptions": []
}
"""

# ---------------------------------------------------------------------------
# Fallback models & retry configuration
# ---------------------------------------------------------------------------
FALLBACK_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-latest",
]


def _call_gemini_with_fallback(client, preferred_model: str, contents: str) -> str:
    """
    Call Gemini with automatic fallback across multiple models and retries
    on 503 UNAVAILABLE (high demand) or 404 NOT_FOUND (model decommissioned).
    """
    # Build candidate model list with preferred_model first, deduplicated
    models_to_try = [preferred_model] + [m for m in FALLBACK_MODELS if m != preferred_model]
    
    last_exc = None
    for model in models_to_try:
        # For each candidate model, attempt up to 2 times
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config={"response_mime_type": "application/json"},
                )
                return response.text
            except genai_errors.ServerError as exc:
                last_exc = exc
                # 503 UNAVAILABLE: brief pause, then retry or fallback to next model
                if "503" in str(exc) or "UNAVAILABLE" in str(exc):
                    if attempt == 0:
                        time.sleep(1.0)
                        continue
                    # On second 503 for this model, fall through to try next model in pool
                    break
                else:
                    raise RuntimeError(f"Gemini server error ({model}): {exc}") from exc
            except genai_errors.ClientError as exc:
                last_exc = exc
                # 404 NOT_FOUND: model name decommissioned or unavailable, try next candidate model
                if "404" in str(exc) or "NOT_FOUND" in str(exc):
                    break
                # Other 4xx (e.g. invalid API key, bad request) fail immediately
                raise RuntimeError(
                    f"Gemini API error (check your API key). Details: {exc}"
                ) from exc

    raise RuntimeError(
        "All AI models are currently experiencing high demand. "
        f"Please try again in a few moments. Details: {last_exc}"
    )


class GeminiProvider(LLMProvider):
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured.")
        self.client = genai.Client(api_key=api_key)
        self.model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

    def generate_constraint(self, user_text: str) -> GeneratedConstraint:
        prompt = f"""{SYSTEM_PROMPT}

User requirement:
{user_text}

Generate the corresponding GeneratedConstraint JSON.
"""
        # Call with automatic fallback across models
        raw = _call_gemini_with_fallback(self.client, self.model, prompt)

        try:
            return GeneratedConstraint.model_validate_json(raw)
        except (ValidationError, ValueError) as first_error:
            # Retry once with error feedback so the LLM can self-correct
            retry_prompt = f"""{SYSTEM_PROMPT}

User requirement:
{user_text}

Your previous output failed validation with this error:
{first_error}

Raw output that failed:
{raw}

Please correct the JSON so it satisfies the schema exactly. Return ONLY the corrected JSON object.
"""
            retry_raw = _call_gemini_with_fallback(self.client, self.model, retry_prompt)
            return GeneratedConstraint.model_validate_json(retry_raw)

