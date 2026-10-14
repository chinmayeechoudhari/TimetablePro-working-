import json
from unittest.mock import Mock, patch

import pytest

from app.constraints.llm.gemini import GeminiProvider


# ============================================================
# SHARED VALID GEMINI RESPONSE
# ============================================================

VALID_CONSTRAINT = {
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


# ============================================================
# 1. MISSING API KEY
# ============================================================

@patch("app.constraints.llm.gemini.genai.Client")
def test_missing_api_key_is_rejected(mock_client, monkeypatch):
    """
    GeminiProvider should fail immediately when the API key
    is not configured.
    """

    monkeypatch.delenv(
        "GEMINI_API_KEY",
        raising=False,
    )

    with pytest.raises(
        RuntimeError,
        match="GEMINI_API_KEY is not configured.",
    ):
        GeminiProvider()

    mock_client.assert_not_called()


# ============================================================
# 2. API KEY IS USED
# ============================================================

@patch("app.constraints.llm.gemini.genai.Client")
def test_api_key_is_used_to_create_client(mock_client, monkeypatch):
    """
    GeminiProvider should initialize the Gemini client using
    GEMINI_API_KEY.
    """

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )

    GeminiProvider()

    mock_client.assert_called_once_with(
        api_key="test-api-key"
    )


# ============================================================
# 3. DEFAULT MODEL
# ============================================================

@patch("app.constraints.llm.gemini.genai.Client")
def test_default_model_is_used(mock_client, monkeypatch):
    """
    GEMINI_MODEL should default to gemini-3.6-flash when it
    is not configured.
    """

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )

    monkeypatch.delenv(
        "GEMINI_MODEL",
        raising=False,
    )

    provider = GeminiProvider()

    assert provider.model == "gemini-3.6-flash"


# ============================================================
# 4. CUSTOM MODEL
# ============================================================

@patch("app.constraints.llm.gemini.genai.Client")
def test_custom_model_is_used(mock_client, monkeypatch):
    """
    GEMINI_MODEL should override the default model.
    """

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )

    monkeypatch.setenv(
        "GEMINI_MODEL",
        "custom-gemini-model",
    )

    provider = GeminiProvider()

    assert provider.model == "custom-gemini-model"


# ============================================================
# 5. VALID RESPONSE IS PARSED
# ============================================================

@patch("app.constraints.llm.gemini.genai.Client")
def test_valid_response_is_parsed(mock_client, monkeypatch):
    """
    A valid Gemini JSON response should be converted into
    a GeneratedConstraint object.
    """

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )

    response = Mock()

    response.text = json.dumps(
        VALID_CONSTRAINT
    )

    mock_client.return_value.models.generate_content.return_value = (
        response
    )

    provider = GeminiProvider()

    result = provider.generate_constraint(
        "Rahul cannot be assigned."
    )

    assert result.model_dump() == VALID_CONSTRAINT


# ============================================================
# 6. CORRECT GEMINI MODEL IS USED
# ============================================================

@patch("app.constraints.llm.gemini.genai.Client")
def test_generate_constraint_uses_configured_model(
    mock_client,
    monkeypatch,
):
    """
    generate_constraint() should send the request using the
    configured Gemini model.
    """

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )

    monkeypatch.setenv(
        "GEMINI_MODEL",
        "test-model",
    )

    response = Mock()

    response.text = json.dumps(
        VALID_CONSTRAINT
    )

    mock_client.return_value.models.generate_content.return_value = (
        response
    )

    provider = GeminiProvider()

    provider.generate_constraint(
        "Rahul cannot be assigned."
    )

    mock_client.return_value.models.generate_content.assert_called_once()

    call = (
        mock_client
        .return_value
        .models
        .generate_content
        .call_args
    )

    assert call.kwargs["model"] == "test-model"


# ============================================================
# 7. JSON RESPONSE MODE IS REQUESTED
# ============================================================

@patch("app.constraints.llm.gemini.genai.Client")
def test_json_response_mode_is_requested(
    mock_client,
    monkeypatch,
):
    """
    Gemini should be instructed to return JSON.
    """

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )

    response = Mock()

    response.text = json.dumps(
        VALID_CONSTRAINT
    )

    mock_client.return_value.models.generate_content.return_value = (
        response
    )

    provider = GeminiProvider()

    provider.generate_constraint(
        "Rahul cannot be assigned."
    )

    call = (
        mock_client
        .return_value
        .models
        .generate_content
        .call_args
    )

    config = call.kwargs["config"]

    assert config["response_mime_type"] == "application/json"


# ============================================================
# 8. USER REQUIREMENT IS INCLUDED IN PROMPT
# ============================================================

@patch("app.constraints.llm.gemini.genai.Client")
def test_user_requirement_is_included_in_prompt(
    mock_client,
    monkeypatch,
):
    """
    The user's natural-language requirement should be included
    in the prompt sent to Gemini.
    """

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )

    response = Mock()

    response.text = json.dumps(
        VALID_CONSTRAINT
    )

    mock_client.return_value.models.generate_content.return_value = (
        response
    )

    provider = GeminiProvider()

    user_text = (
        "Rahul can teach at most 3 periods on Monday."
    )

    provider.generate_constraint(user_text)

    call = (
        mock_client
        .return_value
        .models
        .generate_content
        .call_args
    )

    prompt = call.kwargs["contents"]

    assert user_text in prompt


# ============================================================
# 9. INVALID JSON IS REJECTED
# ============================================================

@patch("app.constraints.llm.gemini.genai.Client")
def test_invalid_json_response_is_rejected(
    mock_client,
    monkeypatch,
):
    """
    Invalid JSON returned by Gemini should not silently pass
    through the provider.
    """

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )

    response = Mock()

    response.text = "this is not valid JSON"

    mock_client.return_value.models.generate_content.return_value = (
        response
    )

    provider = GeminiProvider()

    with pytest.raises(
        Exception,
    ):
        provider.generate_constraint(
            "Rahul cannot be assigned."
        )


# ============================================================
# 10. INVALID SCHEMA IS REJECTED
# ============================================================

@patch("app.constraints.llm.gemini.genai.Client")
def test_invalid_constraint_schema_is_rejected(
    mock_client,
    monkeypatch,
):
    """
    Valid JSON is not enough. The generated object must also
    satisfy GeneratedConstraint's schema.
    """

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )

    invalid_constraint = {
        "constraint_type": "hard",
        "weight": 100,
        "expression": {
            "kind": "forbid",
            "filter": {
                "kind": "atomic",
                "field": "teacher",
                "operator": "eq",
                "value": "Rahul",
            },
        },
        "explanation": "Invalid hard constraint.",
        "assumptions": [],
    }

    response = Mock()

    response.text = json.dumps(
        invalid_constraint
    )

    mock_client.return_value.models.generate_content.return_value = (
        response
    )

    provider = GeminiProvider()

    with pytest.raises(
        Exception,
    ):
        provider.generate_constraint(
            "Rahul cannot be assigned."
        )


# ============================================================
# 11. GEMINI API ERRORS ARE PROPAGATED
# ============================================================

@patch("app.constraints.llm.gemini.genai.Client")
def test_gemini_api_error_is_propagated(
    mock_client,
    monkeypatch,
):
    """
    Provider/API errors should be propagated rather than
    silently swallowed.
    """

    monkeypatch.setenv(
        "GEMINI_API_KEY",
        "test-api-key",
    )

    mock_client.return_value.models.generate_content.side_effect = (
        RuntimeError("Gemini API failed")
    )

    provider = GeminiProvider()

    with pytest.raises(
        RuntimeError,
        match="Gemini API failed",
    ):
        provider.generate_constraint(
            "Rahul cannot be assigned."
        )