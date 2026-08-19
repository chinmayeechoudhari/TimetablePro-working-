from __future__ import annotations

from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ============================================================
# 1. ATOMIC CONDITIONS
# ============================================================

class AtomicCondition(BaseModel):
    """
    A single condition such as:

        teacher == Rahul
        subject == DBMS
        day == Monday
        period <= 3
    """

    model_config = ConfigDict(extra="forbid")

    kind: Literal["atomic"] = "atomic"

    field: Literal[
        "teacher",
        "subject",
        "class",
        "room",
        "room_type",
        "subject_type",
        "day",
        "period",
        "slot",
    ]

    operator: Literal[
        "eq",
        "neq",
        "lt",
        "lte",
        "gt",
        "gte",
    ]

    value: Any


# ============================================================
# 2. LOGICAL CONDITIONS
# ============================================================

class AndCondition(BaseModel):
    """Logical AND of multiple conditions."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["and"] = "and"

    conditions: list["Condition"]

    @model_validator(mode="after")
    def must_have_conditions(self):
        if not self.conditions:
            raise ValueError("AND must contain at least one condition")
        return self


class OrCondition(BaseModel):
    """Logical OR of multiple conditions."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["or"] = "or"

    conditions: list["Condition"]

    @model_validator(mode="after")
    def must_have_conditions(self):
        if not self.conditions:
            raise ValueError("OR must contain at least one condition")
        return self


class NotCondition(BaseModel):
    """Logical NOT of a condition."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["not"] = "not"

    condition: "Condition"


Condition = Annotated[
    Union[
        AtomicCondition,
        AndCondition,
        OrCondition,
        NotCondition,
    ],
    Field(discriminator="kind"),
]


# ============================================================
# 3. NUMERIC EXPRESSIONS
# ============================================================

class ConstantExpression(BaseModel):
    """A numeric constant such as 3 or 5."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["constant"] = "constant"

    value: int | float


class CountExpression(BaseModel):
    """
    Counts assignment variables satisfying a condition.

    Example:

        COUNT(
            assignments WHERE
            teacher == Rahul AND day == Monday
        )
    """

    model_config = ConfigDict(extra="forbid")

    kind: Literal["count"] = "count"

    source: Literal["assignments"] = "assignments"

    filter: Condition


NumericExpression = Annotated[
    Union[
        ConstantExpression,
        CountExpression,
    ],
    Field(discriminator="kind"),
]


# ============================================================
# 4. COMPARISON EXPRESSION
# ============================================================

class ComparisonExpression(BaseModel):
    """
    Mathematical comparison.

    Example:

        COUNT(...) <= 3
    """

    model_config = ConfigDict(extra="forbid")

    kind: Literal["comparison"] = "comparison"

    operator: Literal[
        "eq",
        "neq",
        "lt",
        "lte",
        "gt",
        "gte",
    ]

    left: NumericExpression
    right: NumericExpression


# ============================================================
# 5. SPECIAL CONSTRAINT EXPRESSIONS
# ============================================================

class ForbidExpression(BaseModel):
    """
    Forbids assignments matching a filter.

    Example:

        Rahul cannot teach Monday period 3.
    """

    model_config = ConfigDict(extra="forbid")

    kind: Literal["forbid"] = "forbid"

    filter: Condition


class ExistsExpression(BaseModel):
    """
    Requires at least one matching assignment.

    Example:

        AI must occur on Monday.
    """

    model_config = ConfigDict(extra="forbid")

    kind: Literal["exists"] = "exists"

    source: Literal["assignments"] = "assignments"

    filter: Condition


class NoAdjacentExpression(BaseModel):
    """
    Prevents consecutive assignments matching a filter.

    Example:

        Rahul should not have consecutive periods.
    """

    model_config = ConfigDict(extra="forbid")

    kind: Literal["no_adjacent"] = "no_adjacent"

    filter: Condition


# ============================================================
# 6. FOR-EACH EXPRESSION
# ============================================================

class ForEachExpression(BaseModel):
    """
    Applies an expression independently for every value
    of a dimension.

    Example:

        For every day:
            COUNT(DBMS on that day) <= 1
    """

    model_config = ConfigDict(extra="forbid")

    kind: Literal["for_each"] = "for_each"

    dimension: Literal[
        "day",
        "teacher",
        "subject",
        "class",
        "room",
    ]

    expression: "Expression"


# ============================================================
# 7. COMPLETE EXPRESSION TYPE
# ============================================================

Expression = Annotated[
    Union[
        ComparisonExpression,
        ForbidExpression,
        ExistsExpression,
        NoAdjacentExpression,
        ForEachExpression,
    ],
    Field(discriminator="kind"),
]


# ============================================================
# 8. COMPLETE CONSTRAINT
# ============================================================

class GeneratedConstraint(BaseModel):
    """
    Complete dynamic timetable constraint.

    Example:

        Rahul can teach at most 3 periods on Monday.
    """

    model_config = ConfigDict(extra="forbid")

    constraint_type: Literal["hard", "soft"]

    weight: int | float | None = None

    expression: Expression

    explanation: str

    assumptions: list[str] = []

    @model_validator(mode="after")
    def validate_weight(self):
        if self.constraint_type == "soft":
            if self.weight is None:
                raise ValueError(
                    "Soft constraints must specify a weight"
                )

            if self.weight <= 0:
                raise ValueError(
                    "Soft constraint weight must be greater than 0"
                )

        elif self.weight is not None:
            raise ValueError(
                "Hard constraints must not specify a weight"
            )

        return self


# Resolve forward references
AndCondition.model_rebuild()
OrCondition.model_rebuild()
NotCondition.model_rebuild()
ForEachExpression.model_rebuild()