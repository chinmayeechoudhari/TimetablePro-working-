import pytest
from pydantic import ValidationError

from app.constraints.schemas import GeneratedConstraint


def test_valid_hard_teacher_daily_constraint():
    data = {
        "constraint_type": "hard",
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
        "explanation": "Rahul can teach at most 3 periods on Monday.",
        "assumptions": [],
    }

    constraint = GeneratedConstraint.model_validate(data)

    assert constraint.constraint_type == "hard"
    assert constraint.expression.kind == "comparison"


def test_valid_soft_constraint():
    data = {
        "constraint_type": "soft",
        "weight": 5,
        "expression": {
            "kind": "comparison",
            "operator": "lte",
            "left": {
                "kind": "count",
                "source": "assignments",
                "filter": {
                    "kind": "atomic",
                    "field": "teacher",
                    "operator": "eq",
                    "value": "Rahul",
                },
            },
            "right": {
                "kind": "constant",
                "value": 3,
            },
        },
        "explanation": "Prefer Rahul to teach at most 3 periods.",
        "assumptions": [],
    }

    constraint = GeneratedConstraint.model_validate(data)

    assert constraint.constraint_type == "soft"
    assert constraint.weight == 5


def test_soft_constraint_requires_weight():
    data = {
        "constraint_type": "soft",
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "teacher",
                "operator": "eq",
                "value": "Rahul",
            },
        },
        "explanation": "Rahul should not teach.",
    }

    with pytest.raises(ValidationError):
        GeneratedConstraint.model_validate(data)


def test_hard_constraint_cannot_have_weight():
    data = {
        "constraint_type": "hard",
        "weight": 5,
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "teacher",
                "operator": "eq",
                "value": "Rahul",
            },
        },
        "explanation": "Rahul should not teach.",
    }

    with pytest.raises(ValidationError):
        GeneratedConstraint.model_validate(data)


def test_invalid_field_is_rejected():
    data = {
        "constraint_type": "hard",
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "student",
                "operator": "eq",
                "value": "Rahul",
            },
        },
        "explanation": "Invalid constraint.",
    }

    with pytest.raises(ValidationError):
        GeneratedConstraint.model_validate(data)


def test_invalid_operator_is_rejected():
    data = {
        "constraint_type": "hard",
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "teacher",
                "operator": "approximately",
                "value": "Rahul",
            },
        },
        "explanation": "Invalid constraint.",
    }

    with pytest.raises(ValidationError):
        GeneratedConstraint.model_validate(data)


def test_extra_field_is_rejected():
    data = {
        "constraint_type": "hard",
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "teacher",
                "operator": "eq",
                "value": "Rahul",
            },
        },
        "explanation": "Rahul should not teach.",
        "malicious_field": "some unexpected value",
    }

    with pytest.raises(ValidationError):
        GeneratedConstraint.model_validate(data)