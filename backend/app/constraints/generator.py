from app.constraints.llm.gemini import GeminiProvider
from app.constraints.schemas import GeneratedConstraint


class ConstraintGenerator:

    def __init__(self):
        self.provider = GeminiProvider()

    def generate(
        self,
        user_text: str,
    ) -> GeneratedConstraint:

        if not user_text or not user_text.strip():
            raise ValueError(
                "Constraint text cannot be empty."
            )

        return self.provider.generate_constraint(
            user_text.strip()
        )