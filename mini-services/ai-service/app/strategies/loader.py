from __future__ import annotations

"""
YAML strategy loader.
Loads strategy definitions from YAML files in the presets directory.
"""

import logging
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

# Path to built-in strategy presets
PRESETS_DIR = Path(__file__).parent / "presets"


def load_strategy(strategy_id: str) -> dict[str, Any] | None:
    """
    Load a strategy definition by its ID.

    Args:
        strategy_id: Strategy identifier, e.g. "ma_crossover"

    Returns:
        Strategy definition dict, or None if not found.
    """
    strategy_file = PRESETS_DIR / f"{strategy_id}.yaml"
    if not strategy_file.exists():
        logger.warning(f"Strategy file not found: {strategy_file}")
        return None

    try:
        with open(strategy_file, "r", encoding="utf-8") as f:
            strategy = yaml.safe_load(f)
        return strategy
    except yaml.YAMLError as e:
        logger.error(f"Failed to parse strategy YAML {strategy_id}: {e}")
        return None
    except Exception as e:
        logger.error(f"Failed to load strategy {strategy_id}: {e}")
        return None


def list_strategies() -> list[dict[str, Any]]:
    """
    List all available strategy definitions.

    Returns:
        List of strategy definition dicts.
    """
    strategies = []
    if not PRESETS_DIR.exists():
        return strategies

    for yaml_file in PRESETS_DIR.glob("*.yaml"):
        try:
            with open(yaml_file, "r", encoding="utf-8") as f:
                strategy = yaml.safe_load(f)
            if strategy and "id" in strategy:
                strategies.append(strategy)
        except yaml.YAMLError as e:
            logger.error(f"Failed to parse strategy file {yaml_file}: {e}")
        except Exception as e:
            logger.error(f"Failed to load strategy file {yaml_file}: {e}")

    return strategies


def validate_strategy(strategy: dict[str, Any]) -> list[str]:
    """
    Validate a strategy definition.
    Returns a list of validation errors (empty if valid).
    """
    errors = []
    required_fields = ["name", "id", "type", "entry_condition", "exit_condition"]

    for field in required_fields:
        if field not in strategy:
            errors.append(f"Missing required field: {field}")

    if "id" in strategy and not isinstance(strategy["id"], str):
        errors.append("Field 'id' must be a string")

    if "parameters" in strategy and not isinstance(strategy["parameters"], dict):
        errors.append("Field 'parameters' must be a dictionary")

    if "risk_management" in strategy:
        rm = strategy["risk_management"]
        if not isinstance(rm, dict):
            errors.append("Field 'risk_management' must be a dictionary")
        elif "stop_loss_pct" in rm and not isinstance(rm["stop_loss_pct"], (int, float)):
            errors.append("Field 'risk_management.stop_loss_pct' must be a number")

    return errors
