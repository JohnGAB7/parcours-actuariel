"""Numerical and bilingual checks for the A2/S06 pure and gross premium reference sheet."""
from math import exp, isclose
from pathlib import Path

import yaml

from tools.construire import charger_seance
from tools.validation_contenus import verifier_overlay_traduction
from tools.fiche_reference import verifier_fiche

ROOT = Path(__file__).resolve().parents[2]


def test_a2_s06_reference_sheet_is_ready_and_bilingual():
    fr = charger_seance("a2/s06", "fr")
    en = charger_seance("a2/s06", "en")
    overlay = yaml.safe_load((ROOT / "contenus/en/a2/s06.yaml").read_text(encoding="utf-8"))
    assert fr["fiche"]["statut"] == "prete"
    assert not verifier_fiche(fr["fiche"], session_id="a2/s06")
    assert not verifier_overlay_traduction(fr, overlay, session_id="a2/s06")
    assert en["fiche"]["cours_complet"]["sections"][0]["titre"] == "1. The pure premium"


def test_a2_s06_figures_reconcile():
    assert isclose(0.02 * 500, 10) and isclose(0.02 * 400, 8)
    theta, d, u, freq = 2000, 500, 10000, 0.05
    pure = freq * theta * exp(-d / theta)
    gross = pure * 1.2 / 0.75
    assert round(exp(-0.25), 4) == 0.7788 and round(pure, 2) == 77.88
    assert round(1 - exp(-0.25), 4) == 0.2212 and round(gross, 2) == 124.61
    assert round(0.25 * gross, 2) == 31.15 and round(gross - pure - 0.25 * gross, 2) == 15.58
    assert isclose(0.75 / 1.2, 0.625) and isclose(0.75 / 1.2 + 0.25, 0.875)
    limit = theta * (1 - exp(-u / theta))
    assert round(exp(-5), 6) == 0.006738 and round(limit, 2) == 1986.52 and round(theta - limit, 2) == 13.48
    layer = theta * (exp(-d / theta) - exp(-u / theta))
    assert round(layer, 2) == 1544.13 and round(freq * layer, 2) == 77.21
    after = freq * 2200 * exp(-500 / 2200)
    assert round(after, 2) == 87.64 and round(100 * (after / pure - 1), 1) == 12.5


def test_a2_s06_lab_code_runs():
    session = yaml.safe_load((ROOT / "contenus/a2/s06.yaml").read_text(encoding="utf-8"))
    app = session["fiche"]["applications_labs"]["applications"][0]
    block = next(item for item in app["procedure"] if "gross =" in item)
    fence = chr(96) * 3
    code = block.split(fence + "python", 1)[1].split(fence, 1)[0].strip()
    namespace = {}
    exec(compile(code, "a2_s06_reference_lab.py", "exec"), namespace)
    assert round(namespace["gross"], 2) == 124.61 and round(namespace["margin"], 2) == 15.58
