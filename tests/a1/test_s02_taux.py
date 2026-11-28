"""Tests de l'exercice de la séance a1/s02. Les mêmes tests tournent dans le site (Pyodide)."""
import pytest
import yaml
from pathlib import Path

from exercices.a1 import s02_taux as ex
from tests.a1 import reference as ref

SEANCE = yaml.safe_load((Path(__file__).resolve().parents[2] / "contenus/a1/s02.yaml").read_text(encoding="utf-8"))
TESTS = next(e for e in SEANCE["etapes"] if e["type"] == "code")["tests"]


def _evaluer(module, expr):
    return eval(expr, vars(module).copy())


@pytest.mark.parametrize("t", TESTS, ids=[t["nom"] for t in TESTS])
def test_corrige_passe_les_tests(t):
    """Garde-fou : le corrigé doit passer chaque test, sinon c'est le test qui est faux."""
    assert _evaluer(ref, t["expr"])


@pytest.mark.parametrize("t", TESTS, ids=[t["nom"] for t in TESTS])
def test_ton_code(t):
    try:
        resultat = _evaluer(ex, t["expr"])
    except NotImplementedError:
        pytest.skip("Fonction pas encore écrite : à toi de jouer.")
    assert resultat, t["nom"]


def test_annuite_fractionnee_geometric_sum_and_nominal_rates():
    """The geometric-sum identity must use nominal interest, not nominal discount."""
    n, i, m = 5, 0.06, 12
    v = 1 / (1 + i)
    i_m = ref.nominal_rate(i, m)
    d_m = m * (1 - v ** (1 / m))
    closed_form = (1 - v**n) / i_m
    explicit_sum = ref.annuity_mthly(n, i, m)
    geometric_sum = v ** (1 / m) * (1 - v**n) / (m * (1 - v ** (1 / m)))
    assert explicit_sum == pytest.approx(closed_form)
    assert explicit_sum == pytest.approx(geometric_sum)
    assert d_m != pytest.approx(i_m)
    assert m * (v ** (-1 / m) - 1) == pytest.approx(i_m)
