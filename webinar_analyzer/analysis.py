import pandas as pd


def participant_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Return summary statistics of participants"""
    summary = df.describe(include='all')
    return summary


# Placeholder for Codex-generated repetitive code
# Additional analysis functions could be added here using Codex
