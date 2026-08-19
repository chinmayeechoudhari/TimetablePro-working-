from unittest.mock import Mock

from ortools.sat.python import cp_model

from app.constraints.pipeline import ConstraintPipeline
from app.constraints.schemas import GeneratedConstraint


# ============================================================
# TEST DATA
# ============================================================

CONSTRAINT = GeneratedConstraint.model_validate(
    {
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
)


# ============================================================
# 1. GENERATION → VALIDATION → COMPILATION
# ============================================================

def test_pipeline_runs_complete_workflow(monkeypatch):
    """
    The pipeline should:

        1. Generate the constraint.
        2. Validate the constraint.
        3. Compile the constraint.
    """

    generator = Mock()

    generator.generate.return_value = CONSTRAINT

    pipeline = ConstraintPipeline(
        generator=generator,
    )

    model = cp_model.CpModel()

    assign = {}

    data = {}

    db = Mock()

    validate_mock = Mock()
    compile_mock = Mock(
        return_value=[]
    )

    monkeypatch.setattr(
        "app.constraints.pipeline.validate_constraint",
        validate_mock,
    )

    monkeypatch.setattr(
        "app.constraints.pipeline.compile_constraint",
        compile_mock,
    )

    result = pipeline.process(
        db=db,
        model=model,
        assign=assign,
        data=data,
        user_request="Rahul cannot be assigned.",
    )

    assert result == (
        CONSTRAINT,
        [],
    )

    generator.generate.assert_called_once_with(
        "Rahul cannot be assigned."
    )

    validate_mock.assert_called_once_with(
        db,
        CONSTRAINT,
    )

    compile_mock.assert_called_once_with(
        model=model,
        assign=assign,
        constraint=CONSTRAINT,
        data=data,
    )


# ============================================================
# 2. GENERATOR ERROR IS PROPAGATED
# ============================================================

def test_pipeline_propagates_generator_error(monkeypatch):
    """
    If constraint generation fails, the pipeline should
    propagate the error and stop processing.
    """

    generator = Mock()

    generator.generate.side_effect = RuntimeError(
        "Gemini API failed"
    )

    pipeline = ConstraintPipeline(
        generator=generator,
    )

    db = Mock()
    model = cp_model.CpModel()

    assign = {}
    data = {}

    validate_mock = Mock()
    compile_mock = Mock()

    monkeypatch.setattr(
        "app.constraints.pipeline.validate_constraint",
        validate_mock,
    )

    monkeypatch.setattr(
        "app.constraints.pipeline.compile_constraint",
        compile_mock,
    )

    try:
        pipeline.process(
            db=db,
            model=model,
            assign=assign,
            data=data,
            user_request="Rahul cannot be assigned.",
        )
        assert False, "Expected RuntimeError"
    except RuntimeError as exc:
        assert str(exc) == "Gemini API failed"

    validate_mock.assert_not_called()
    compile_mock.assert_not_called()


# ============================================================
# 3. VALIDATION ERROR STOPS PIPELINE
# ============================================================

def test_pipeline_stops_when_validation_fails(monkeypatch):
    """
    If entity validation fails, compilation must not occur.
    """

    generator = Mock()

    generator.generate.return_value = CONSTRAINT

    pipeline = ConstraintPipeline(
        generator=generator,
    )

    db = Mock()
    model = cp_model.CpModel()

    assign = {}
    data = {}

    validation_error = ValueError(
        "Unknown teacher: Rahul"
    )

    validate_mock = Mock(
        side_effect=validation_error
    )

    compile_mock = Mock()

    monkeypatch.setattr(
        "app.constraints.pipeline.validate_constraint",
        validate_mock,
    )

    monkeypatch.setattr(
        "app.constraints.pipeline.compile_constraint",
        compile_mock,
    )

    try:
        pipeline.process(
            db=db,
            model=model,
            assign=assign,
            data=data,
            user_request="Rahul cannot be assigned.",
        )
        assert False, "Expected ValueError"
    except ValueError as exc:
        assert str(exc) == "Unknown teacher: Rahul"

    generator.generate.assert_called_once()

    validate_mock.assert_called_once_with(
        db,
        CONSTRAINT,
    )

    compile_mock.assert_not_called()


# ============================================================
# 4. COMPILER PENALTIES ARE RETURNED
# ============================================================

def test_pipeline_returns_compiler_penalties(monkeypatch):
    """
    Soft constraint penalties returned by the compiler should
    be returned by the pipeline unchanged.
    """

    generator = Mock()

    generator.generate.return_value = CONSTRAINT

    pipeline = ConstraintPipeline(
        generator=generator,
    )

    model = cp_model.CpModel()

    assign = {}
    data = {}
    db = Mock()

    penalties = [
        model.NewIntVar(
            0,
            10,
            "penalty",
        )
    ]

    monkeypatch.setattr(
        "app.constraints.pipeline.validate_constraint",
        Mock(),
    )

    monkeypatch.setattr(
        "app.constraints.pipeline.compile_constraint",
        Mock(return_value=penalties),
    )

    result_constraint, result_penalties = pipeline.process(
        db=db,
        model=model,
        assign=assign,
        data=data,
        user_request="Rahul cannot be assigned.",
    )

    assert result_constraint == CONSTRAINT
    assert result_penalties == penalties


# ============================================================
# 5. DEFAULT GENERATOR IS CREATED
# ============================================================

def test_pipeline_creates_default_generator(monkeypatch):
    """
    If no generator is supplied, the pipeline should create
    a ConstraintGenerator automatically.
    """

    generator = Mock()

    monkeypatch.setattr(
        "app.constraints.pipeline.ConstraintGenerator",
        Mock(return_value=generator),
    )

    pipeline = ConstraintPipeline()

    assert pipeline.generator is generator