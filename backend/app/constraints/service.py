from __future__ import annotations

from sqlalchemy.orm import Session
from ortools.sat.python import cp_model

from app.constraints.generator import ConstraintGenerator
from app.constraints.validator import validate_constraint
from app.constraints.compiler import compile_constraint
from app.constraints.schemas import GeneratedConstraint


class ConstraintService:
    def __init__(self):
        self.generator = ConstraintGenerator()

    def generate_and_validate(self, db: Session, user_text: str) -> GeneratedConstraint:
        constraint = self.generator.generate(user_text)
        validate_constraint(db, constraint)
        return constraint

    def compile(self, model: cp_model.CpModel, assign: dict, constraint: GeneratedConstraint, data: dict) -> list:
        penalties = compile_constraint(
            model=model,
            assign=assign,
            constraint=constraint,
            data=data,
        )

        # For soft constraints with a user-specified weight > 1, scale the penalty
        # by creating a new IntVar and adding the relationship via CP-SAT constraints
        # (IntVar objects cannot be multiplied by Python scalars directly).
        weight = constraint.weight if constraint.constraint_type == "soft" else None
        if weight is not None and weight != 1 and penalties:
            scaled = []
            for i, penalty in enumerate(penalties):
                if isinstance(penalty, (int, float)):
                    # Already a plain number (e.g. from tests) — just scale normally
                    scaled.append(int(penalty * weight))
                else:
                    # OR-Tools IntVar — must create a new var and link via model.Add
                    ub = penalty.Proto().domain[-1] * int(weight)
                    scaled_var = model.NewIntVar(0, max(ub, 0), f"scaled_penalty_{i}")
                    model.Add(scaled_var == penalty * int(weight))
                    scaled.append(scaled_var)
            return scaled

        return penalties

    def generate_validate_and_compile(
        self,
        db: Session,
        model: cp_model.CpModel,
        assign: dict,
        data: dict,
        user_text: str,
    ) -> tuple[GeneratedConstraint, list]:
        constraint = self.generate_and_validate(db=db, user_text=user_text)
        penalties = self.compile(
            model=model,
            assign=assign,
            constraint=constraint,
            data=data,
        )
        return constraint, penalties
