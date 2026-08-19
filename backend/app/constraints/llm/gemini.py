import json
import os

from google import genai

from app.constraints.schemas import GeneratedConstraint
from app.constraints.llm.base import LLMProvider


SYSTEM_PROMPT = """
You are a constraint-generation engine for an academic timetable
optimization system.

Convert the user's natural-language timetable requirement into
exactly ONE JSON object representing the logical constraint.

Return ONLY JSON.
Do not use Markdown.
Do not return Python code.
Do not return OR-Tools code.

The JSON object MUST have:

{
  "constraint_type": "hard" or "soft",
  "weight": number or null,
  "expression": {...},
  "explanation": "plain English explanation",
  "assumptions": []
}

RULES:

1. HARD CONSTRAINTS
   - constraint_type must be "hard"
   - weight must be null

2. SOFT CONSTRAINTS
   - constraint_type must be "soft"
   - weight must be a positive number

3. ATOMIC CONDITION

{
  "kind": "atomic",
  "field": "...",
  "operator": "...",
  "value": ...
}

Allowed fields:
- teacher
- subject
- class
- room
- room_type
- subject_type
- day
- period
- slot

Allowed operators:
- eq
- neq
- lt
- lte
- gt
- gte

4. AND CONDITION

{
  "kind": "and",
  "conditions": [
    condition,
    condition
  ]
}

5. OR CONDITION

{
  "kind": "or",
  "conditions": [
    condition,
    condition
  ]
}

6. NOT CONDITION

{
  "kind": "not",
  "condition": condition
}

7. COUNT EXPRESSION

{
  "kind": "count",
  "source": "assignments",
  "filter": condition
}

8. CONSTANT EXPRESSION

{
  "kind": "constant",
  "value": number
}

9. COMPARISON EXPRESSION

{
  "kind": "comparison",
  "operator": "eq|neq|lt|lte|gt|gte",
  "left": numeric_expression,
  "right": numeric_expression
}

10. FORBID EXPRESSION

{
  "kind": "forbid",
  "filter": condition
}

11. EXISTS EXPRESSION

{
  "kind": "exists",
  "source": "assignments",
  "filter": condition
}

12. NO ADJACENT EXPRESSION

{
  "kind": "no_adjacent",
  "filter": condition
}

13. FOR EACH EXPRESSION

{
  "kind": "for_each",
  "dimension": "day|teacher|subject|class|room",
  "expression": expression
}

IMPORTANT:
- Never invent fields.
- Never invent expression kinds.
- Never invent operators.
- Preserve the user's meaning.
- Do not invent database IDs.
- If the user mentions a teacher, subject, class, room, day, etc.,
  preserve the human-readable value exactly.
- If the requirement is ambiguous, put the ambiguity in "assumptions".
- Do not silently change the user's requirement.
"""


class GeminiProvider(LLMProvider):

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not configured."
            )

        self.client = genai.Client(api_key=api_key)

        self.model = os.getenv(
            "GEMINI_MODEL",
            "gemini-3.6-flash"
        )

    def generate_constraint(
    self,
    user_text: str,
) -> GeneratedConstraint:

        prompt = f"""
{SYSTEM_PROMPT}

User requirement:

{user_text}

Generate the corresponding GeneratedConstraint.
"""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",

            },
        )

        constraint = GeneratedConstraint.model_validate_json(
            response.text
        )
        return constraint