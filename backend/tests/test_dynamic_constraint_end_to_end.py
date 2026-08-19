from unittest.mock import Mock

from ortools.sat.python import cp_model

from app.constraints.compiler import compile_constraint
from app.constraints.generator import ConstraintGenerator
from app.constraints.schemas import GeneratedConstraint
from app.constraints.validator import validate_constraint


def test_natural_language_constraint_reaches_compiler(
    monkeypatch,
):
    """
    Verify the core dynamic constraint pipeline:

        natural language
            -> ConstraintGenerator
            -> GeneratedConstraint
            -> entity validation
            -> compiler
    """

    generated_constraint = {
        "constraint_type": "hard",
        "weight": None,
        "expression": {
            "kind": "comparison",
            "operator": "lte",
            "left": {
                "kind": "count",
                "source": "assignments",
                "filter": {
                    "kind": "and",
                    "conditions": [
                        {
                            "kind": "atomic",
                            "field": "teacher",
                            "operator": "eq",
                            "value": "Rahul",
                        },
                        {
                            "kind": "atomic",
                            "field": "day",
                            "operator": "eq",
                            "value": "Monday",
                        },
                    ],
                },
            },
            "right": {
                "kind": "constant",
                "value": 3,
            },
        },
        "explanation": (
            "Rahul can teach at most 3 periods on Monday."
        ),
        "assumptions": [],
    }

    # ---------------------------------------------------------
    # 1. Mock Gemini
    # ---------------------------------------------------------

    generator = ConstraintGenerator()

    provider = Mock()

    provider.generate_constraint.return_value = (
        generated_constraint
    )

    generator.provider = provider

    # ---------------------------------------------------------
    # 2. Generate structured constraint
    # ---------------------------------------------------------

    result = generator.generate(
        "Rahul can teach at most 3 periods on Monday."
    )

    assert result == generated_constraint

    provider.generate_constraint.assert_called_once_with(
        "Rahul can teach at most 3 periods on Monday."
    )

    # ---------------------------------------------------------
    # 3. Convert provider dictionary into Pydantic model
    # ---------------------------------------------------------

    validated_constraint = GeneratedConstraint.model_validate(
        result
    )

    assert validated_constraint.constraint_type == "hard"

    # ---------------------------------------------------------
    # 4. Mock entity resolution
    #
    # Entity resolution is already independently tested by:
    #
    #   test_entity_resolver.py
    #   test_constraint_validation.py
    #
    # This test is specifically checking that the generated
    # constraint crosses the validation -> compiler boundary.
    # ---------------------------------------------------------

    monkeypatch.setattr(
        "app.constraints.validator.resolve_teacher",
        Mock(),
    )

    monkeypatch.setattr(
        "app.constraints.validator.resolve_day_slots",
        Mock(return_value=[]),
    )

    db = Mock()

    # ---------------------------------------------------------
    # 5. Validate generated constraint
    # ---------------------------------------------------------

    validation_result = validate_constraint(
        db,
        validated_constraint,
    )

    assert validation_result is True

    # ---------------------------------------------------------
    # 6. Compile into CP-SAT
    # ---------------------------------------------------------

    model = cp_model.CpModel()

    assign = {}

    data = {}

    compile_constraint(
        model,
        assign,
        validated_constraint,
        data,
    )