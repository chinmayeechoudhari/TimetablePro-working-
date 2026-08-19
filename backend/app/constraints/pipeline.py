from __future__ import annotations

from sqlalchemy.orm import Session
from ortools.sat.python import cp_model

from app.constraints.generator import ConstraintGenerator
from app.constraints.validator import validate_constraint
from app.constraints.compiler import compile_constraint
from app.constraints.schemas import GeneratedConstraint


class ConstraintPipeline:
    """
    Coordinates the complete dynamic constraint workflow.

    Flow:

        Natural language
             ↓
        Constraint generation
             ↓
        Entity validation
             ↓
        CP-SAT compilation
    """

    def __init__(
        self,
        generator: ConstraintGenerator | None = None,
    ):
        self.generator = generator or ConstraintGenerator()

    def process(
        self,
        db: Session,
        model: cp_model.CpModel,
        assign: dict,
        data: dict,
        user_request: str,
    ) -> tuple[GeneratedConstraint, list]:
        """
        Generate, validate, and compile a natural-language
        timetable constraint.

        Returns:
            (
                generated_constraint,
                penalty_variables
            )
        """

        # --------------------------------------------------
        # 1. Generate structured constraint
        # --------------------------------------------------

        constraint = self.generator.generate(
            user_request
        )

        # --------------------------------------------------
        # 2. Validate referenced entities
        # --------------------------------------------------

        validate_constraint(
            db,
            constraint,
        )

        # --------------------------------------------------
        # 3. Compile into CP-SAT
        # --------------------------------------------------

        penalties = compile_constraint(
            model=model,
            assign=assign,
            constraint=constraint,
            data=data,
        )

        return constraint, penalties