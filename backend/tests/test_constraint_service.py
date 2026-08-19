from unittest.mock import Mock

import pytest

from app.constraints.generator import ConstraintGenerator


def make_generator():
    """
    Create ConstraintGenerator without constructing the real
    GeminiProvider.
    """
    generator = object.__new__(ConstraintGenerator)
    generator.provider = Mock()
    return generator


def test_empty_constraint_text_is_rejected():
    generator = make_generator()

    with pytest.raises(
        ValueError,
        match="Constraint text cannot be empty.",
    ):
        generator.generate("   ")

    generator.provider.generate_constraint.assert_not_called()


def test_constraint_text_is_stripped_before_sending():
    generator = make_generator()

    expected_constraint = {
        "constraint_type": "hard",
        "weight": None,
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "teacher",
                "operator": "eq",
                "value": "Rahul",
            },
        },
        "explanation": "Rahul cannot be assigned.",
        "assumptions": [],
    }

    generator.provider.generate_constraint.return_value = (
        expected_constraint
    )

    result = generator.generate(
        "   Rahul cannot be assigned.   "
    )

    assert result == expected_constraint

    generator.provider.generate_constraint.assert_called_once_with(
        "Rahul cannot be assigned."
    )


def test_provider_error_is_propagated():
    generator = make_generator()

    generator.provider.generate_constraint.side_effect = RuntimeError(
        "Gemini API failed"
    )

    with pytest.raises(
        RuntimeError,
        match="Gemini API failed",
    ):
        generator.generate(
            "Rahul cannot teach more than 3 periods on Monday."
        )


def test_valid_constraint_is_returned_unchanged():
    generator = make_generator()

    generated_constraint = {
        "constraint_type": "hard",
        "weight": None,
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "teacher",
                "operator": "eq",
                "value": "Rahul",
            },
        },
        "explanation": "Rahul cannot be assigned.",
        "assumptions": [],
    }

    generator.provider.generate_constraint.return_value = (
        generated_constraint
    )

    result = generator.generate(
        "Rahul cannot be assigned."
    )

    assert result is generated_constraint

    generator.provider.generate_constraint.assert_called_once_with(
        "Rahul cannot be assigned."
    )


def test_non_empty_text_is_forwarded_to_provider():
    generator = make_generator()

    expected_constraint = {
        "constraint_type": "hard",
        "weight": None,
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "teacher",
                "operator": "eq",
                "value": "Rahul",
            },
        },
        "explanation": "Rahul cannot be assigned.",
        "assumptions": [],
    }

    generator.provider.generate_constraint.return_value = (
        expected_constraint
    )

    result = generator.generate(
        "Rahul cannot be assigned."
    )

    assert result == expected_constraint

    generator.provider.generate_constraint.assert_called_once_with(
        "Rahul cannot be assigned."
    )