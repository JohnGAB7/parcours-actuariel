"""Tests for the optional self-contained lesson reference-sheet schema."""
from copy import deepcopy

from tools.validation_contenus import verifier_fiche, verifier_seance


def _valid_fiche():
    return {
        "statut": "prete",
        "vue_ensemble": {
            "question": "How does compound interest work?",
            "pourquoi": "It values cash flows over time.",
            "objectifs": ["Calculate an accumulation factor."],
            "prerequis": ["Basic algebra."],
            "carte": ["Rates", "Discounting", "Annuities"],
            "duree_minutes": 30,
        },
        "cours_complet": {"sections": [{
            "titre": "Effective annual rate",
            "contenu": "A unit capital grows to (1+i)^t after t years.",
            "formules": [{"formule": r"\text{AV} = C(1+i)^t",
                          "explication": "The accumulation factor is applied t times."}],
        }]},
        "methodes": {"methodes": [{
            "titre": "Discount a future cash flow",
            "quand_utiliser": "When a payment is valued before its due date.",
            "etapes": ["Identify the rate and time basis.", "Divide by (1+i)^t."],
            "controles": ["Check that present value is below future value for i > 0."],
            "erreurs": ["Mixing an annual rate with a monthly period count."],
        }]},
        "exemples_guides": {"exemples": [{
            "titre": "Discount one payment",
            "enonce": "Find the present value of 1,000 due in two years at 5%.",
            "raisonnement": ["Set C=1,000, i=0.05 and t=2.", "Compute 1,000/(1.05)^2."],
            "resultat": "907.03 monetary units.",
            "interpretation": "The amount today is lower than the future payment.",
            "controles": ["Re-accumulate 907.03 for two years."],
        }]},
        "exercices_corriges": {"exercices": [{
            "titre": "Two-year discounting", "niveau": "fondamental",
            "enonce": "Discount 500 due in two years at 4%.",
            "corrige": ["v=1/1.04.", "PV=500v^2=462.28."],
            "feedback": "A larger positive rate lowers the present value.",
        }]},
        "applications_labs": {"applications": [{
            "titre": "Present value of a benefit cash flow",
            "contexte": "A pension plan values a deterministic future benefit.",
            "objectif": "Reproduce a discounted cash-flow calculation.",
            "outils": ["excel", "python"],
            "entrees": ["Payment amount", "Annual effective rate", "Payment date"],
            "hypotheses": ["The rate is constant over the horizon."],
            "procedure": ["Convert the payment date into years.", "Apply the discount factor."],
            "sorties": ["Present value per payment."],
            "validation": ["Compare Excel and Python outputs."],
            "limites": ["No uncertainty in the payment or discount rate."],
        }]},
        "synthese_references": {
            "memo": ["PV is the sum of discounted cash flows."],
            "glossaire": [{"terme_fr": "Valeur actuelle", "terme_en": "Present value",
                           "definition": "Value at the valuation date of future cash flows."}],
            "maitrise": ["I can explain the rate-period convention.", "I can discount a dated cash flow."],
            "liens": [{"titre": "Next session", "cible": "a1/s02#annuites"}],
            "references": [{"titre": "Theory of Interest",
                            "detail": "Reference for compound interest and annuities.",
                            "annee": 2006}],
        },
    }


def _session(fiche):
    return {
        "id": "a1/s01", "module": "a1", "titre": "Intérêt composé",
        "en": "Compound interest", "duree": 30,
        "etapes": [{"type": "video", "titre": "Introduction", "minutes": 1, "texte": "Intro."}],
        "fiche": fiche,
    }


def test_ready_reference_sheet_accepts_all_seven_substantive_tabs():
    assert verifier_fiche(_valid_fiche(), session_id="a1/s01") == []
    assert verifier_seance(_session(_valid_fiche()), session_id="a1/s01") == []


def test_draft_reference_sheet_can_be_incremental_but_explicitly_marked():
    assert verifier_fiche({"statut": "brouillon"}, session_id="a1/s01") == []
    assert verifier_fiche({
        "statut": "brouillon",
        "vue_ensemble": {
            "question": "A guiding question", "pourquoi": "A reason to learn this.",
            "objectifs": ["One objective."], "prerequis": ["One prerequisite."],
            "carte": ["One concept."], "duree_minutes": 20,
        },
    }, session_id="a1/s01") == []


def test_ready_sheet_cannot_omit_a_tab_or_publish_empty_content():
    missing_tab = _valid_fiche()
    del missing_tab["methodes"]
    assert any("methodes" in error and "doit contenir" in error
               for error in verifier_fiche(missing_tab, session_id="a1/s01"))
    empty_course = _valid_fiche()
    empty_course["cours_complet"]["sections"] = []
    assert any("sections" in error for error in verifier_fiche(empty_course, session_id="a1/s01"))


def test_reference_sheet_rejects_unknown_fields_and_unsafe_internal_links():
    unknown = _valid_fiche()
    unknown["cours_complet"]["html"] = "<script>alert(1)</script>"
    assert any("clé inconnue" in error for error in verifier_fiche(unknown, session_id="a1/s01"))
    unsafe = _valid_fiche()
    unsafe["synthese_references"]["liens"][0]["cible"] = "../../outside"
    assert any("référence interne" in error
               for error in verifier_fiche(unsafe, session_id="a1/s01"))


def test_reference_sheet_rejects_invalid_exercise_levels_and_unannotated_references():
    invalid = _valid_fiche()
    invalid["exercices_corriges"]["exercices"][0]["niveau"] = "expert"
    invalid["synthese_references"]["references"] = [{"titre": "Book", "detail": ""}]
    errors = verifier_fiche(invalid, session_id="a1/s01")
    assert any("niveau" in error for error in errors)
    assert any("titre" in error or "detail" in error for error in errors)


def test_reference_sheet_formula_structure_is_protected_in_english_overlay():
    from tools.validation_contenus import fusionner_overlay

    base = {"fiche": {"statut": "prete", "cours_complet": {"sections": [{
        "titre": "Intérêt composé", "contenu": "Un capital croît.",
        "formules": [{"formule": r"\text{VA} = C v^t",
                      "explication": "Le flux est actualisé."}],
    }]}}}
    translated = {"fiche": {"cours_complet": {"sections": [{
        "titre": "Compound interest", "contenu": "A capital grows.",
        "formules": [{"formule": r"\text{PV} = C v^t",
                      "explication": "The cash flow is discounted."}],
    }]}}}
    merged = fusionner_overlay(base, translated, "a1/s01")
    from tools.validation_contenus import verifier_overlay_traduction
    assert verifier_overlay_traduction(base, translated, session_id="a1/s01") == []
    assert merged["fiche"]["statut"] == "prete"
    assert merged["fiche"]["cours_complet"]["sections"][0]["formules"][0]["formule"] == r"\text{PV} = C v^t"

    invalid = deepcopy(translated)
    invalid["fiche"]["cours_complet"]["sections"][0]["formules"][0]["formule"] = r"\text{PV} = 2 C v^t"
    try:
        fusionner_overlay(base, invalid, "a1/s01")
    except ValueError:
        pass
    else:
        raise AssertionError("An English overlay changed the mathematical formula.")


def test_reference_sheet_rejects_malformed_types_without_raising():
    invalid_status = {"statut": []}
    assert any("statut" in error for error in verifier_fiche(invalid_status, session_id="a1/s01"))

    invalid = _valid_fiche()
    invalid["vue_ensemble"]["duree_minutes"] = float("nan")
    invalid["exercices_corriges"]["exercices"][0]["niveau"] = {}
    invalid["applications_labs"]["applications"][0]["outils"] = [{}]
    errors = verifier_fiche(invalid, session_id="a1/s01")
    assert any("duree_minutes" in error for error in errors)
    assert any("niveau" in error for error in errors)
    assert any("outils" in error for error in errors)


def test_legacy_session_without_reference_sheet_remains_compatible():
    legacy = _session(None)
    del legacy["fiche"]
    assert verifier_seance(legacy, session_id="a1/s01") == []


def test_fiche_a1_s01_est_complete_et_bilingue():
    from tools.construire import charger_seance
    from tools.validation_contenus import verifier_overlay_traduction

    fr = charger_seance("a1/s01", "fr")
    en = charger_seance("a1/s01", "en")
    assert fr["fiche"]["statut"] == "prete"
    assert set(fr["fiche"]) == {
        "statut", "vue_ensemble", "cours_complet", "methodes", "exemples_guides",
        "exercices_corriges", "applications_labs", "synthese_references",
    }
    assert not verifier_overlay_traduction(
        fr, __import__("yaml").safe_load(
            (__import__("pathlib").Path(__file__).resolve().parents[1] / "contenus/en/a1/s01.yaml").read_text(encoding="utf-8")
        ), session_id="a1/s01"
    )
    assert en["fiche"]["cours_complet"]["sections"][0]["titre"] == "1. Time convention and annual effective rate"
    assert len(en["fiche"]["exercices_corriges"]["exercices"]) == 3


def test_fiche_a1_s02_est_complete_et_bilingue():
    from pathlib import Path
    import yaml
    from tools.construire import charger_seance
    from tools.validation_contenus import verifier_overlay_traduction

    root = Path(__file__).resolve().parents[1]
    fr = charger_seance("a1/s02", "fr")
    en = charger_seance("a1/s02", "en")
    overlay = yaml.safe_load((root / "contenus/en/a1/s02.yaml").read_text(encoding="utf-8"))
    assert fr["fiche"]["statut"] == "prete"
    assert len(fr["fiche"]["cours_complet"]["sections"]) >= 7
    assert len(fr["fiche"]["methodes"]["methodes"]) == 3
    assert len(fr["fiche"]["exemples_guides"]["exemples"]) == 3
    assert len(fr["fiche"]["exercices_corriges"]["exercices"]) == 3
    assert fr["fiche"]["applications_labs"]["applications"][0]["outils"] == ["excel", "python"]
    assert not verifier_overlay_traduction(fr, overlay, session_id="a1/s02")
    assert en["fiche"]["cours_complet"]["sections"][0]["titre"] == "1. Convention and definition of a nominal rate"
    assert len(en["fiche"]["exercices_corriges"]["exercices"]) == 3


def test_nominal_rate_sheet_code_lab_has_reproducible_checks():
    from pathlib import Path
    import yaml

    root = Path(__file__).resolve().parents[1]
    session = yaml.safe_load((root / "contenus/a1/s02.yaml").read_text(encoding="utf-8"))
    lab = session["fiche"]["applications_labs"]["applications"][0]
    code = next(step for step in lab["procedure"] if isinstance(step, str) and "def nominal_from_effective" in step)
    namespace = {}
    exec(code.split("```python", 1)[1].split("```", 1)[0], namespace)
    assert namespace["effective_from_nominal"](0.06, 12) > namespace["effective_from_nominal"](0.06, 4) > 0.06
    assert abs(namespace["annuity_mthly"](10, 0.04, 12, 1200) - 9910.25) < 0.1


def test_fiche_a1_s03_est_structuree_et_bilingue():
    from pathlib import Path
    import yaml
    from tools.construire import charger_seance
    from tools.validation_contenus import verifier_overlay_traduction

    root = Path(__file__).resolve().parents[1]
    fr = charger_seance("a1/s03", "fr")
    en = charger_seance("a1/s03", "en")
    overlay = yaml.safe_load((root / "contenus/en/a1/s03.yaml").read_text(encoding="utf-8"))
    assert fr["fiche"]["statut"] == "prete"  # Editorial readiness; independent review is disclosed in the notice.
    assert len(fr["fiche"]["cours_complet"]["sections"]) == 6
    assert len(fr["fiche"]["methodes"]["methodes"]) == 2
    assert len(fr["fiche"]["exemples_guides"]["exemples"]) == 3
    assert len(fr["fiche"]["exercices_corriges"]["exercices"]) == 3
    assert not verifier_overlay_traduction(fr, overlay, session_id="a1/s03")
    assert en["fiche"]["cours_complet"]["sections"][0]["titre"] == "1. Accumulated value"


def test_s03_reference_examples_and_limiting_cases_are_numerically_consistent():
    import math

    i, n = 0.05, 10
    v = 1 / (1 + i)
    a = (1 - v**n) / i
    due = (1 + i) * a
    increasing = sum(k * v**k for k in range(1, n + 1))
    decreasing = sum((n + 1 - k) * v**k for k in range(1, n + 1))
    assert math.isclose(increasing, 39.3737828047, abs_tol=1e-9)
    assert math.isclose(decreasing, 45.5653014163, abs_tol=1e-9)
    assert math.isclose(increasing + decreasing, (n + 1) * a, abs_tol=1e-10)

    i, g, n = 0.05, 0.02, 10
    direct = sum((1 + g) ** (k - 1) / (1 + i) ** k for k in range(1, n + 1))
    closed = (1 - ((1 + g) / (1 + i)) ** n) / (i - g)
    assert math.isclose(direct, closed, abs_tol=1e-12)
    assert math.isclose(1000 * closed, 8388.1056524, abs_tol=1e-8)

    # The special case i=g gives n discounted terms, each equal to v.
    assert math.isclose(sum((1 + g) ** (k - 1) / (1 + g) ** k for k in range(1, n + 1)), n / (1 + g), abs_tol=1e-12)
    # At zero interest, both arithmetic annuities equal their nominal sum.
    assert math.isclose(sum(k for k in range(1, n + 1)), n * (n + 1) / 2)
    assert math.isclose(sum(n + 1 - k for k in range(1, n + 1)), n * (n + 1) / 2)
    # Growing perpetuity converges only if the discounted geometric ratio is below one.
    assert (1 + 0.03) / (1 + 0.05) < 1
    assert (1 + 0.03) / (1 + 0.025) >= 1
    # At i=0, a geometrically declining perpetuity with -1<g<0 still converges.
    assert math.isclose(sum((1 - 0.02) ** (k - 1) for k in range(1, 10000)), 50.0, abs_tol=1e-10)
    assert (1 - 0.02) / (1 + 0.0) < 1
    # A level perpetuity at zero interest does not converge.
    assert (1 + 0.0) / (1 + 0.0) == 1

def test_english_overlay_preserves_nontranslatable_internal_link_targets():
    from tools.validation_contenus import fusionner_overlay

    base = {"fiche": {"synthese_references": {
        "liens": [{"titre": "Séance suivante", "cible": "a1/s02#annuites"}]
    }}}
    overlay = {"fiche": {"synthese_references": {
        "liens": [{"titre": "Next session"}]
    }}}
    merged = fusionner_overlay(base, overlay, "a1/s01")
    link = merged["fiche"]["synthese_references"]["liens"][0]
    assert link["titre"] == "Next session"
    assert link["cible"] == "a1/s02#annuites"

def test_fiche_a1_s04_est_complete_et_bilingue():
    from pathlib import Path
    import yaml
    from tools.construire import charger_seance
    from tools.validation_contenus import verifier_overlay_traduction

    root = Path(__file__).resolve().parents[1]
    fr = charger_seance('a1/s04', 'fr')
    en = charger_seance('a1/s04', 'en')
    overlay = yaml.safe_load((root / 'contenus/en/a1/s04.yaml').read_text(encoding='utf-8'))
    assert fr['fiche']['statut'] == 'prete'
    assert len(fr['fiche']['cours_complet']['sections']) == 7
    assert len(fr['fiche']['methodes']['methodes']) == 3
    assert len(fr['fiche']['exemples_guides']['exemples']) == 3
    assert len(fr['fiche']['exercices_corriges']['exercices']) == 3
    assert not verifier_overlay_traduction(fr, overlay, session_id='a1/s04')
    assert en['fiche']['cours_complet']['sections'][0]['titre'] == '1. Equation of value and level payment'


def test_s04_loan_sheet_numerics_and_two_balance_methods_agree():
    import math
    L, i, n = 10_000, 0.06, 5
    a = lambda m: (1 - (1 + i) ** (-m)) / i if m else 0
    s = lambda m: ((1 + i) ** m - 1) / i if m else 0
    P = L / a(n)
    B2_prospective = P * a(n - 2)
    B2_retrospective = L * (1 + i) ** 2 - P * s(2)
    assert math.isclose(P, 2373.9640043118943, abs_tol=1e-9)
    assert math.isclose(B2_prospective, 6345.634151117494, abs_tol=1e-9)
    assert math.isclose(B2_prospective, B2_retrospective, abs_tol=1e-9)
    interest3 = i * B2_prospective
    principal3 = P - interest3
    assert math.isclose(interest3, 380.73804906705, abs_tol=1e-9)
    assert math.isclose(principal3, 1993.22595524484, abs_tol=1e-9)


def test_s04_reference_python_lab_is_executable_and_reproducible():
    from pathlib import Path
    import yaml
    root = Path(__file__).resolve().parents[1]
    session = yaml.safe_load((root / 'contenus/a1/s04.yaml').read_text(encoding='utf-8'))
    lab = session['fiche']['applications_labs']['applications'][0]
    code = next(item for item in lab['procedure'] if isinstance(item, str) and 'def level_payment' in item)
    namespace = {}
    exec(code.split('```python', 1)[1].split('```', 1)[0], namespace)
    payment = namespace['level_payment'](10_000, 5, 0.06)
    schedule = namespace['amortization_schedule'](10_000, 5, 0.06)
    assert len(schedule) == 5
    assert abs(payment - 2373.9640043) < 1e-6
    assert abs(schedule[1][3] - 6345.6341511) < 1e-6
    assert abs(schedule[-1][3]) < 1e-8
    assert abs(sum(row[2] for row in schedule) - 10_000) < 1e-8
    assert abs(namespace['level_payment'](1200, 12, 0) - 100) < 1e-12