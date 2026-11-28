"""Regression tests for the canonical validation/build boundary."""

import pytest

import tools.construire as builder


def test_build_rejects_invalid_content_before_removing_previous_site(tmp_path, monkeypatch):
    output = tmp_path / "_site"
    output.mkdir()
    marker = output / "previous-build.txt"
    marker.write_text("last successful build", encoding="utf-8")

    monkeypatch.setattr(builder, "SORTIE", output)
    monkeypatch.setattr(builder, "verifier_depot", lambda: ["invalid session fixture"])

    with pytest.raises(SystemExit, match="invalid session fixture"):
        builder.construire()

    assert marker.read_text(encoding="utf-8") == "last successful build"


def test_verifier_cli_uses_the_canonical_validator(monkeypatch, capsys):
    errors = ["parcours.yaml: invalid fixture"]
    monkeypatch.setattr(builder, "verifier_depot", lambda: errors)
    monkeypatch.setattr(
        builder,
        "construire",
        lambda: pytest.fail("the validation-only command must not build the site"),
    )

    assert builder.main(["--verifier"]) == 1
    assert "parcours.yaml: invalid fixture" in capsys.readouterr().err


def test_verifier_cli_reports_success_when_canonical_validator_passes(monkeypatch, capsys):
    monkeypatch.setattr(builder, "verifier_depot", lambda: [])

    assert builder.main(["--verifier"]) == 0
    assert "structurally valid" in capsys.readouterr().out


def test_english_pages_write_formula_numbers_the_english_way():
    assert builder.nombres_tex_en(r"\frac{1\,881{,}25^2}{1\,527\,460{,}94}") == r"\frac{1{,}881.25^2}{1{,}527{,}460.94}"
    assert builder.nombres_tex_en(r"f_{1,\,2} = 0{,}05 \quad \theta\,e^{-d/\theta}") == r"f_{1,\,2} = 0.05 \quad \theta\,e^{-d/\theta}"
    s = builder.charger_seance("a2/s01", "en")
    formules = [q["pourquoi"].get("formule", "") for e in s["etapes"] if e["type"] == "quiz" for q in e["questions"]]
    assert not any("{,}" in f for f in formules if "0" in f and "." not in f)
    assert any("0.2 \\times 0.15" in f for f in formules)


def test_homepage_is_bilingual_and_keeps_resume_progression_hook():
    parcours = builder.charger_parcours()
    first = next(builder.seances(parcours))[2]
    session = builder.charger_seance(first)
    titles = {first: (len(session["etapes"]), session["titre"])}

    french = builder.page_accueil(parcours, titles, "fr")
    english = builder.page_accueil(parcours, titles, "en")

    assert 'data-reprendre' in french and 'data-reprendre' in english
    assert 'class="hero-visual"' in french and 'class="hero-visual"' in english
    assert "Construis tes fondamentaux actuariels." in french
    assert "Build your actuarial foundations." in english
    assert "EXPLORER LE PARCOURS" in french
    assert "EXPLORE THE CURRICULUM" in english
    assert f'>{sum(1 for _ in builder.seances(parcours)):02d}<' in french
    assert "FR · EN" in french and "FR · EN" in english
    template = (builder.SITE / "gabarits" / "page.html").read_text(encoding="utf-8")
    assert "assets/vendor/katex/katex.min.css" in template
    assert "assets/math-render.js" in template


def test_actu_basics_parent_brand_is_consistent_in_both_languages():
    french = builder.marque("", "fr")
    english = builder.marque("", "en")

    assert "LABORATOIRE ACTUARIEL" in french and "PAR ACTU-BASICS" in french
    assert "ACTUARIAL LEARNING LAB" in english and "BY ACTU-BASICS" in english
    assert 'assets/actuarial-lab-mark.svg' in french
    assert 'assets/actuarial-lab-mark-dark.svg' not in french
    assert 'assets/actuarial-lab-mark.svg' in english
    assert 'assets/actuarial-lab-mark-dark.svg' not in english
    assert 'loading="eager" decoding="async"' in french
    assert 'src="../../assets/actuarial-lab-mark.svg"' in builder.marque("../../en/", "en", "../../")
    assert 'src="../../assets/actuarial-lab-mark.svg"' in builder.marque("../../", "fr", "../../")
    assert builder.favicon_url("fr") == "assets/actuarial-lab-mark.svg"
    assert builder.favicon_url("en") == "assets/actuarial-lab-mark.svg"
    assert builder.titre_site("fr") == "Laboratoire d’apprentissage actuariel par ACTU-BASICS"
    assert builder.titre_site("en") == "Actuarial Learning Lab by ACTU-BASICS"


def test_footer_brand_uses_asset_base_not_language_root():
    parcours = builder.charger_parcours()
    footer = builder.pied(parcours, "../../en/", "../../index.html", "en", "../../")

    assert 'src="../../assets/actuarial-lab-mark.svg"' in footer
    assert 'src="../../en/assets/actuarial-lab-mark.svg"' not in footer


def test_short_domain_labels_keep_full_titles_off_navigation_surfaces():
    parcours = builder.charger_parcours()
    fr = [builder.dom_court(d, "fr") for d in parcours["domaines"]]
    en = [builder.dom_court(d, "en") for d in parcours["domaines"]]
    assert fr == ["Fondamentaux", "Vie", "Retraite", "Non-vie", "ALM", "Risque", "Outils"]
    assert en == ["Foundations", "Life", "Pensions", "P&C", "ALM", "Risk", "Tools"]
    first = next(builder.seances(parcours))[2]
    session = builder.charger_seance(first)
    homepage = builder.page_accueil(parcours, {first: (len(session["etapes"]), session["titre"])}, "fr")
    assert "Pensions and employee benefits" not in homepage
    assert "Asset-liability management" not in homepage
    assert 'class="dom-t">Retraite</span>' in homepage


def test_lab_brand_names_are_bilingual_and_parent_brand_is_explicit():
    assert builder.titre_site("fr") == "Laboratoire d’apprentissage actuariel par ACTU-BASICS"
    assert builder.titre_site("en") == "Actuarial Learning Lab by ACTU-BASICS"
    assert "LABORATOIRE ACTUARIEL" in builder.marque("", "fr")
    assert "PAR ACTU-BASICS" in builder.marque("", "fr")
    assert "ACTUARIAL LEARNING LAB" in builder.marque("", "en")
    assert "BY ACTU-BASICS" in builder.marque("", "en")


def test_lesson_shell_uses_full_desktop_workspace_and_step_labels():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    template = (root / "site" / "gabarits" / "seance.html").read_text(encoding="utf-8")
    stylesheet = (root / "site" / "assets" / "style.css").read_text(encoding="utf-8")
    script = (root / "site" / "assets" / "seance.js").read_text(encoding="utf-8")

    assert 'class="lesson-shell gutter"' in template
    assert 'class="lesson-rail"' in template
    assert "grid-template-columns:260px minmax(0,1fr)" in stylesheet
    assert "rail-step-name" in script
    assert 'type="image/svg+xml"' in template
    assert '(<(?:strong|b)>[A-Z]<\\/(?:strong|b)>)\\s*[-–—]\\s*(?=<)' in script


def test_rich_enumeration_separator_is_removed_before_any_inline_formula_tag():
    import re

    source = (builder.SITE / "assets" / "seance.js").read_text(encoding="utf-8")
    assert "template.innerHTML = String(value ?? \"\").replace" in source
    pattern = re.compile(r'(<(?:strong|b)>[A-Z]</(?:strong|b)>)\s*[-–—]\s*(?=<)')
    assert pattern.sub(r"\1 ", '<strong>A</strong>-<span class="katex">δ=i</span>') == (
        '<strong>A</strong> <span class="katex">δ=i</span>'
    )
