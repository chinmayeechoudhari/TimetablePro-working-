from abc import ABC, abstractmethod


class LLMProvider(ABC):

    @abstractmethod
    def generate_constraint(self, user_text: str) -> dict:
        """
        Convert natural language into a structured constraint.
        """
        raise NotImplementedError