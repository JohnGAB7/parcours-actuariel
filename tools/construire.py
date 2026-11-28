"""Construit le site statique dans _site/ à partir de contenus/*.yaml.

    python tools/construire.py            # écrit _site/
    python tools/construire.py --verifier # vérifie seulement les contenus

Le contenu (YAML) est séparé de la présentation (site/gabarits, site/assets).
Site bilingue : français à la racine, anglais sous en/. Les textes anglais d'une séance vivent dans
contenus/en/<id>.yaml, qui ne contient que des textes : chiffres, réponses et tests restent dans le fichier français.
"""
from __future__ import annotations

import html
import json
import os
import re
import shutil
import sys
from pathlib import Path
from string import Template

import yaml

# Run as a script (python tools/construire.py), the repository root is not on sys.path: add it for the tools package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools.validation_contenus import (  # noqa: E402
    fusionner_overlay,
    verifier_depot,
    verifier_overlay_traduction,
    verifier_seance,
)

RACINE = Path(__file__).resolve().parents[1]
CONTENUS = RACINE / "contenus"
SITE = RACINE / "site"
SORTIE = RACINE / "_site"
LANGUES = ("fr", "en")
# Compatibility alias for existing tests and downstream imports.
fusion = fusionner_overlay


def charger_parcours() -> dict:
    return yaml.safe_load((CONTENUS / "parcours.yaml").read_text(encoding="utf-8"))


def nombres_tex_en(tex: str) -> str:
    """Write the numbers of a French LaTeX formula the English way: 1\\,881{,}25 becomes 1{,}881.25."""
    tex = re.sub(r"(?<=\d)\{,\}(?=\d)", ".", tex)
    return re.sub(r"(?<=\d)\\,(?=\d{3}(?!\d))", "{,}", tex)


def _formules_en(objet):
    """Formulas and calculation labels stay in the French file: convert their numbers for the English page."""
    if isinstance(objet, dict):
        return {k: nombres_tex_en(v) if k in ("formule", "libelle") and isinstance(v, str) else _formules_en(v)
                for k, v in objet.items()}
    if isinstance(objet, list):
        return [_formules_en(v) for v in objet]
    return objet


def charger_seance(sid: str, langue: str = "fr") -> dict:
    s = yaml.safe_load((CONTENUS / f"{sid}.yaml").read_text(encoding="utf-8"))
    if langue == "fr":
        return s
    return _formules_en(fusionner_overlay(
        s, yaml.safe_load((CONTENUS / langue / f"{sid}.yaml").read_text(encoding="utf-8")), sid
    ))


def verifier_traduction(sid: str) -> list[str]:
    """Compatibility wrapper around the canonical overlay validator."""
    chemin = CONTENUS / "en" / f"{sid}.yaml"
    if not chemin.is_file():
        return [f"{sid} : traduction anglaise manquante (contenus/en/{sid}.yaml)"]
    try:
        base = charger_seance(sid)
        overlay = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as err:
        return [f"{sid} : impossible de lire l'overlay anglais ({err})."]
    return verifier_overlay_traduction(base, overlay, session_id=sid)


def seances(parcours: dict):
    for dom in parcours["domaines"]:
        for m in dom["modules"]:
            for sid in m.get("seances", []):
                yield dom, m, sid


e = html.escape
ICONE_COMPTE = ('<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" '
                'stroke="currentColor" stroke-width="1.7"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" fill="none" '
                'stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>')

TXT = {
    "fr": {
        "domaines": "Domaines", "menu": "Menu des domaines", "compte": "Mon compte", "confid": "Confidentialité",
        "source": "Code source", "compte_t": "Compte", "accueil": "Accueil", "fil": "Fil d'Ariane",
        "pied": "Contenus rédigés pour ce site, sans reprise de supports de cours. Données fictives ou paramètres publics, avec leur source.",
        "autre": "English", "autre_court": "EN", "autre_aria": "Read this page in English",
        "seance": lambda n: f'{n} séance{"s" if n > 1 else ""}', "a_venir": "À venir", "bientot": "bientôt", "modules": "modules",
        "eyebrow": "Fondamentaux · Vie · Retraite · Non-vie · ALM · Risque",
        "h1": "Remettre la théorie <em>au travail.</em>",
        "hero": "Un rappel court, des questions, un calcul à la main, puis ton propre code Python. Les termes anglais à chaque étape.",
        "commencer": "Commencer", "les_domaines": "Les domaines", "h2": "Sept domaines, une séance de 25 minutes à la fois.",
        "lead": "Commence par les fondamentaux, puis suis l'ordre conseillé. Les domaines marqués « bientôt » se rempliront au fil du parcours.",
        "domaine": "Domaine", "suivant": "Domaine suivant", "module": "Module", "min_etapes": lambda d, n: f"{d} min · {n} étapes",
        "commencer_f": "Commencer", "progression": "Progression de la séance", "etapes": "Étapes",
        "compte_desc": "Compte facultatif pour retrouver ta progression partout.",
    },
    "en": {
        "domaines": "Domains", "menu": "Domain menu", "compte": "My account", "confid": "Privacy",
        "source": "Source code", "compte_t": "Account", "accueil": "Home", "fil": "Breadcrumbs",
        "pied": "Content written for this site, with no reuse of course materials. Fictional data or public parameters, with their source.",
        "autre": "Français", "autre_court": "FR", "autre_aria": "Lire cette page en français",
        "seance": lambda n: f'{n} session{"s" if n > 1 else ""}', "a_venir": "Coming soon", "bientot": "soon", "modules": "modules",
        "eyebrow": "Foundations · Life · Pensions · P&C · ALM · Risk",
        "h1": "Put theory <em>back to work.</em>",
        "hero": "A short recap, questions, a calculation by hand, then your own Python code. French and English terms at every step.",
        "commencer": "Start", "les_domaines": "The domains", "h2": "Seven domains, one 25-minute session at a time.",
        "lead": "Start with the foundations, then follow the suggested order. Domains marked “soon” will fill up as the path grows.",
        "domaine": "Domain", "suivant": "Next domain", "module": "Module", "min_etapes": lambda d, n: f"{d} min · {n} steps",
        "commencer_f": "Start", "progression": "Session progress", "etapes": "Steps",
        "compte_desc": "Optional account to keep your progress on every device.",
    },
}


def dom_titre(d: dict, langue: str) -> str:
    return d["titre"] if langue == "fr" else d["en"]


def dom_sous(d: dict, langue: str) -> str:
    return d["en"] if langue == "fr" else d["titre"]


def dom_accroche(d: dict, langue: str) -> str:
    return d["accroche"] if langue == "fr" else d["accroche_en"]


def mod_titre(m: dict, langue: str) -> str:
    if langue == "fr":
        return m["titre"]
    return m["titre"].split(" · ")[0] + " · " + m["en"]


def mod_sous(m: dict, langue: str) -> str:
    return m["en"] if langue == "fr" else m["titre"].split(" · ", 1)[-1]


def titre_site(langue: str) -> str:
    """Public name of the bilingual actuarial learning lab."""
    return "Actuarial Learning Lab by ACTU-BASICS" if langue == "en" else "Laboratoire d’apprentissage actuariel par ACTU-BASICS"


def dom_court(d: dict, langue: str) -> str:
    """Short labels for navigation and homepage cards; full names remain on domain pages."""
    courts = {
        "fondamentaux": ("Fondamentaux", "Foundations"),
        "vie": ("Vie", "Life"),
        "retraite": ("Retraite", "Pensions"),
        "non-vie": ("Non-vie", "P&C"),
        "alm": ("ALM", "ALM"),
        "risque": ("Risque", "Risk"),
        "outils": ("Outils", "Tools"),
    }
    return courts.get(d["id"], (d["titre"], d["en"]))[0 if langue == "fr" else 1]


def marque(racine: str, langue: str, base: str | None = None) -> str:
    """Use one cacheable mark; asset paths must not include the language prefix."""
    base = racine if base is None else base
    libelle = "ACTUARIAL LEARNING LAB" if langue == "en" else "LABORATOIRE ACTUARIEL"
    signature = "BY ACTU-BASICS" if langue == "en" else "PAR ACTU-BASICS"
    return (
        f'<a class="brand brand-lockup" href="{racine}index.html" aria-label="{libelle} — {signature}">'
        f'<span class="brand-mark">'
        f'<img class="brand-logo" src="{base}assets/actuarial-lab-mark.svg" alt="" width="44" height="44" loading="eager" decoding="async">'
        
        f'</span><span class="brand-copy"><strong>{libelle}</strong><small>{signature}</small></span></a>'
    )


def favicon_url(langue: str) -> str:
    """Local, cacheable vector mark for both language editions."""
    return "assets/actuarial-lab-mark.svg"


def bascule(langue: str, autre: str) -> str:
    """FR | EN switch: the current language is marked, the other one links to the same page in that language."""
    def cote(code):
        if code == langue:
            return f'<span aria-current="true">{code.upper()}</span>'
        aria = TXT[langue]["autre_aria"]
        return f'<a href="{autre}" hreflang="{code}" lang="{code}" aria-label="{aria}" data-langue="{code}">{code.upper()}</a>'
    return f'<span class="langs" role="group" aria-label="Langue · Language">{cote("fr")}{cote("en")}</span>'


def entete(parcours: dict, racine: str, autre: str, langue: str, actif: str = "", base: str | None = None) -> str:
    """Global header: brand, domain menu (inline on wide screens, a sheet on phones), language switch, account."""
    t = TXT[langue]
    liens = "".join(
        f'<a href="{racine}{d["id"]}/index.html"{" aria-current=\"page\"" if d["id"] == actif else ""}>{e(dom_court(d, langue))}</a>'
        for d in parcours["domaines"])
    return (
        f'<header class="nav gutter"><div class="nav-in">'
        f'{marque(racine, langue, base)}'
        f'<nav class="nav-links" aria-label="{t["domaines"]}">{liens}</nav>'
        f'<details class="nav-menu"><summary aria-label="{t["menu"]}" aria-controls="nav-sheet" aria-expanded="false"><span></span><span></span></summary>'
        f'<nav class="nav-sheet" id="nav-sheet" aria-label="{t["domaines"]}">{liens}</nav></details>'
        f'{bascule(langue, autre)}'
        f'<a class="acct" href="{racine}compte/index.html" aria-label="{t["compte"]}">{ICONE_COMPTE}</a>'
        f'</div></header>')


def pied(parcours: dict, racine: str, autre: str, langue: str, base: str | None = None) -> str:
    t = TXT[langue]
    liens = "".join(f'<a href="{racine}{d["id"]}/index.html">{e(dom_court(d, langue))}</a>' for d in parcours["domaines"])
    return (
        f'<footer class="pied gutter"><div class="pied-in">'
        f'<div class="pied-col">{marque(racine, langue, base)}<p>{t["pied"]}</p></div>'
        f'<nav class="pied-col" aria-label="{t["domaines"]}"><span class="eyebrow">{t["domaines"]}</span>{liens}</nav>'
        f'<nav class="pied-col" aria-label="{t["compte_t"]}"><span class="eyebrow">{t["compte_t"]}</span>'
        f'<a href="{racine}compte/index.html">{t["compte"]}</a><a href="{racine}compte/index.html#confidentialite">{t["confid"]}</a>'
        f'<a href="{autre}" lang="{"en" if langue == "fr" else "fr"}">{t["autre"]}</a>'
        f'<a href="https://github.com/JohnGAB7/AB-Actuarial-Lab">{t["source"]}</a></nav>'
        f'</div></footer>')


def plan_json(parcours: dict, titres: dict) -> str:
    """Course order with step counts, read by navigation.js to show progress and the "resume" target."""
    plan = [{"d": dom["id"], "m": m["id"], "s": sid, "n": titres[sid][0], "t": titres[sid][1]} for dom, m, sid in seances(parcours)]
    return json.dumps(plan, ensure_ascii=False).replace("</", "<\\/")


def page_accueil(parcours: dict, titres: dict, langue: str) -> str:
    """Premium learner-first homepage; all counts and links come from the actual curriculum."""
    t = TXT[langue]
    en = langue == "en"
    cartes = []
    for k, d in enumerate(parcours["domaines"], 1):
        n = sum(len(m.get("seances", [])) for m in d["modules"])
        etat = f'{t["seance"](n)} · {len(d["modules"])} {t["modules"]}' if n else f'{len(d["modules"])} {t["modules"]} · {t["bientot"]}'
        cartes.append(
            f'<a class="dom{"" if n else " futur"}" href="{d["id"]}/index.html" data-domaine="{d["id"]}">'
            f'<span class="dom-n mono">{k:02d}</span>'
            f'<span class="dom-t">{e(dom_court(d, langue))}</span><span class="dom-en">{e(dom_court(d, "en" if langue == "fr" else "fr"))}</span>'
            f'<span class="dom-a">{e(dom_accroche(d, langue))}</span>'
            f'<span class="dom-f"><span class="dom-s">{etat}</span><span class="barre" aria-hidden="true"><i></i></span></span></a>')
    premiere = next(seances(parcours))[2]
    premier_dom, premier_module, _ = next(seances(parcours))
    nb_seances = sum(1 for _ in seances(parcours))
    nb_modules = sum(len(d["modules"]) for d in parcours["domaines"])
    sous_titre = parcours["sous_titre"] if not en else parcours["sous_titre_en"]
    titre_premiere = titres[premiere][1]
    if en:
        intro_kicker = "ACTUARIAL LEARNING LAB · BY ACTU-BASICS"
        intro_title = "Understand the idea. See the mathematics. Make it work."
        intro_text = "A structured path from foundations to actuarial practice — built around clear explanations, meaningful experiments and hands-on modelling."
        stat_sessions, stat_domains, stat_languages = "SESSIONS", "LEARNING AREAS", "LANGUAGES"
        start_kicker, start_title = "A GOOD PLACE TO BEGIN", "Build your actuarial foundations."
        start_text = "Start with financial mathematics: the language of rates, cash flows, discounting and annuities that supports much of actuarial work."
        start_action = "Explore the first session"
        domains_kicker, domains_heading = "EXPLORE THE CURRICULUM", "Choose a field. Follow the connections."
        domains_text = "Follow the suggested order or explore a discipline that speaks to your goals. Your progress stays on this device without an account."
        method_kicker, method_heading = "A DIFFERENT WAY TO LEARN", "From intuition to professional practice."
        method = [
            ("01", "Understand", "Start with a question, an intuition or a real actuarial situation."),
            ("02", "Make it visible", "Connect the idea to a formula, a diagram or an interactive experiment."),
            ("03", "Put it to work", "Calculate, test your reasoning and write code against a practical problem."),
        ]
        method_note = "Not just more content. A clearer path from knowing a formula to understanding when and why to use it."
        hero_art_label = "FROM DATA TO DECISION"
        hero_art = [("01", "OBSERVE", "A real question"), ("02", "MODEL", "A mathematical structure"), ("03", "DECIDE", "An explained result")]
        hero_cta = "Start learning"
        mini_kicker, mini_title = "A SMALL EXPERIMENT", "See compound interest take shape."
        mini_text = "Change the starting capital, rate or horizon. The curve and final value update instantly — no account, no spreadsheet."
        mini_capital, mini_rate, mini_years = "Starting capital", "Annual effective rate", "Time horizon"
        mini_future, mini_interest, mini_factor = "Future value", "Interest earned", "Growth factor"
        mini_formula = "A = C × (1 + i)ⁿ · annual compounding, no additional payments"
        mini_chart_aria = "Growth of the capital over time"
        domains_count = "domains"
    else:
        intro_kicker = "LABORATOIRE D'APPRENTISSAGE ACTUARIEL · PAR ACTU-BASICS"
        intro_title = "Comprendre l'idée. Voir les mathématiques. Les mettre au travail."
        intro_text = "Un parcours structuré des fondamentaux à la pratique actuarielle, construit autour d'explications claires, d'expériences pertinentes et de modélisation concrète."
        stat_sessions, stat_domains, stat_languages = "SÉANCES", "DOMAINES", "LANGUES"
        start_kicker, start_title = "UN BON POINT DE DÉPART", "Construis tes fondamentaux actuariels."
        start_text = "Commence par les mathématiques financières : le langage des taux, des flux, de l'actualisation et des annuités qui soutient une grande partie du travail actuariel."
        start_action = "Découvrir la première séance"
        domains_kicker, domains_heading = "EXPLORER LE PARCOURS", "Choisis un domaine. Découvre les liens."
        domains_text = "Suis l'ordre conseillé ou explore une discipline qui correspond à tes objectifs. Ta progression reste sur cet appareil, sans création de compte."
        method_kicker, method_heading = "UNE AUTRE FAÇON D'APPRENDRE", "De l'intuition à la pratique professionnelle."
        method = [
            ("01", "Comprendre", "Partir d'une question, d'une intuition ou d'une situation actuarielle réelle."),
            ("02", "Rendre visible", "Relier l'idée à une formule, un schéma ou une expérience interactive."),
            ("03", "Mettre en pratique", "Calculer, vérifier ton raisonnement et écrire du code sur un problème concret."),
        ]
        method_note = "Pas seulement davantage de contenu : un chemin plus clair entre connaître une formule et comprendre quand et pourquoi l'utiliser."
        hero_art_label = "DE LA DONNÉE À LA DÉCISION"
        hero_art = [("01", "OBSERVER", "Une question réelle"), ("02", "MODÉLISER", "Une structure mathématique"), ("03", "DÉCIDER", "Un résultat expliqué")]
        hero_cta = "Commencer le parcours"
        mini_kicker, mini_title = "UNE EXPÉRIENCE EN 30 SECONDES", "Visualise la puissance des intérêts composés."
        mini_text = "Modifie le capital de départ, le taux ou la durée. La courbe et le résultat évoluent instantanément — sans compte ni tableur."
        mini_capital, mini_rate, mini_years = "Capital initial", "Taux annuel effectif", "Durée"
        mini_future, mini_interest, mini_factor = "Capital final", "Intérêts cumulés", "Multiplicateur"
        mini_formula = "A = C × (1 + i)ⁿ · capitalisation annuelle, sans versements supplémentaires"
        mini_chart_aria = "Évolution du capital au fil du temps"
        domains_count = "domaines"
    art = "".join(
        f'<div class="hero-step"><span class="hero-step-n mono">{num}</span>'
        f'<span class="hero-step-copy"><b>{label}</b><small>{desc}</small></span></div>'
        for num, label, desc in hero_art)
    method_html = "".join(
        f'<article class="method-card"><span class="method-n mono">{num}</span><h3>{title}</h3><p>{desc}</p></article>'
        for num, title, desc in method)
    return (
        f'<section class="hero"><div class="hero-in gutter">'
        f'<div class="hero-copy"><span class="eyebrow">{t["eyebrow"]}</span><h1>{t["h1"]}</h1>'
        f'<p>{e(sous_titre)} {t["hero"]}</p>'
        f'<div class="hero-cta"><a class="cta" href="{premiere}/index.html" data-reprendre>{hero_cta} →</a>'
        f'<a class="cta-2" href="compte/index.html">{ICONE_COMPTE}{t["compte"]}</a></div></div>'
        f'<aside class="hero-visual" aria-label="{hero_art_label}"><span class="hero-visual-label">{hero_art_label}</span>'
        f'<div class="hero-steps">{art}</div><span class="hero-visual-foot">{("ACTUARIAL THINKING · LEARN / MODEL / PRACTICE" if en else "PENSÉE ACTUARIELLE · APPRENDRE / MODÉLISER / PRATIQUER")}</span></aside>'
        f'</div></section>'
        f'<main class="home home-redesign gutter">'
        f'<section class="home-intro"><div class="home-intro-copy"><span class="eyebrow">{intro_kicker}</span>'
        f'<h2>{intro_title}</h2><p>{intro_text}</p></div>'
        f'<div class="home-stats" aria-label="{("Curriculum overview" if en else "Aperçu du parcours")}">'
        f'<div class="home-stat"><strong>{nb_seances:02d}</strong><span>{stat_sessions}</span></div>'
        f'<div class="home-stat"><strong>{len(parcours["domaines"]):02d}</strong><span>{stat_domains}</span></div>'
        f'<div class="home-stat"><strong>FR · EN</strong><span>{stat_languages}</span></div></div></section>'
        f'<section class="start-feature"><div class="start-feature-copy"><span class="eyebrow">{start_kicker}</span>'
        f'<h2>{start_title}</h2><p>{start_text}</p>'
        f'<a class="start-link" href="{premiere}/index.html">{start_action} <span aria-hidden="true">↗</span></a></div>'
        f'<div class="start-feature-meta"><span class="start-index mono">01 / {nb_modules:02d}</span>'
        f'<span class="start-domain">{e(dom_court(premier_dom, langue))}</span>'
        f'<strong>{e(mod_titre(premier_module, langue))}</strong>'
        f'<span class="start-duration">{( "One session at a time" if en else "Une séance à la fois")}</span></div></section>'
        f'<section class="home-mini-lab" id="mini-lab"><div class="mini-lab-head"><span class="eyebrow">{mini_kicker}</span>'
        f'<h2>{mini_title}</h2><p>{mini_text}</p></div>'
        f'<div class="mini-lab-grid"><div class="mini-lab-controls">'
        f'<label class="mini-control"><span>{mini_capital}</span><output id="mini-capital-label">3 000</output><input id="mini-capital" type="range" min="500" max="10000" step="500" value="3000"></label>'
        f'<label class="mini-control"><span>{mini_rate}</span><output id="mini-rate-label">4 %</output><input id="mini-rate" type="range" min="0" max="12" step="0.5" value="4"></label>'
        f'<label class="mini-control"><span>{mini_years}</span><output id="mini-years-label">5</output><input id="mini-years" type="range" min="1" max="30" step="1" value="5"></label>'
        f'<div class="mini-lab-stats"><div><span>{mini_future}</span><strong id="mini-future">—</strong></div><div><span>{mini_interest}</span><strong id="mini-interest">—</strong></div><div><span>{mini_factor}</span><strong id="mini-factor">—</strong></div></div>'
        f'<p class="mini-formula">{mini_formula}</p></div>'
        f'<div class="mini-lab-chart"><canvas id="mini-growth" aria-label="{mini_chart_aria}" role="img"></canvas><p id="mini-chart-summary" class="mini-chart-summary"></p></div></div></section>'
        f'<section class="home-domains"><div class="home-head"><span class="eyebrow">{domains_kicker}</span>'
        f'<h2>{domains_heading}</h2><p class="lead">{domains_text}</p></div>'
        f'<div class="doms">{"".join(cartes)}</div></section>'
        f'<section class="home-method"><div class="home-head"><span class="eyebrow">{method_kicker}</span>'
        f'<h2>{method_heading}</h2></div><div class="method-grid">{method_html}</div>'
        f'<p class="method-note">{method_note}</p></section></main>')


def page_domaine(parcours: dict, d: dict, k: int, langue: str) -> str:
    t = TXT[langue]
    lignes = []
    for m in d["modules"]:
        corps = f'<span class="mod-t">{e(mod_titre(m, langue))}</span><span class="mod-en">{e(mod_sous(m, langue))}</span>'
        if m.get("seances"):
            lignes.append(f'<li><a class="mod" href="../{m["id"]}/index.html" data-module="{m["id"]}"><span class="mod-c">{corps}</span>'
                          f'<span class="mod-s"><span class="mod-n">{t["seance"](len(m["seances"]))}</span>'
                          f'<span class="barre" aria-hidden="true"><i></i></span></span></a></li>')
        else:
            lignes.append(f'<li><span class="mod futur"><span class="mod-c">{corps}</span>'
                          f'<span class="mod-s"><span class="mod-n">{t["a_venir"]}</span></span></span></li>')
    autres = parcours["domaines"]
    suivant = autres[k] if k < len(autres) else None
    lien_suivant = (f'<a class="suite" href="../{suivant["id"]}/index.html"><span class="eyebrow">{t["suivant"]}</span>'
                    f'<span>{e(dom_titre(suivant, langue))} →</span></a>') if suivant else ""
    return (
        f'<main class="page gutter">'
        f'<nav class="fil" aria-label="{e(t["fil"])}"><a href="../index.html">{t["accueil"]}</a><span>/</span><span>{e(dom_titre(d, langue))}</span></nav>'
        f'<div class="page-head"><span class="eyebrow mono">{t["domaine"]} {k:02d}</span><h1>{e(dom_titre(d, langue))}</h1>'
        f'<p class="en">{e(dom_sous(d, langue))}</p><p class="lead">{e(dom_accroche(d, langue))}</p></div>'
        f'<ol class="mods-l">{"".join(lignes)}</ol>{lien_suivant}</main>')


def page_module(d: dict, m: dict, infos: dict, langue: str) -> str:
    t = TXT[langue]
    lignes = []
    for j, sid in enumerate(m["seances"], 1):
        s = infos[sid]
        sous = s["en"] if langue == "fr" else charger_seance(sid)["titre"]
        lignes.append(
            f'<li><a class="sea" href="../{sid}/index.html" data-seance="{sid}">'
            f'<span class="sea-n mono">{j:02d}</span>'
            f'<span class="sea-c"><span class="sea-t">{e(s["titre"])}</span><span class="sea-en">{e(sous)}</span></span>'
            f'<span class="sea-s"><span class="sea-d">{t["min_etapes"](s["duree"], len(s["etapes"]))}</span>'
            f'<span class="barre" aria-hidden="true"><i></i></span><span class="sea-x" data-etat>{t["commencer_f"]}</span></span></a></li>')
    code, nom = mod_titre(m, langue).split(" · ", 1)
    return (
        f'<main class="page gutter">'
        f'<nav class="fil" aria-label="{e(t["fil"])}"><a href="../index.html">{t["accueil"]}</a><span>/</span>'
        f'<a href="../{d["id"]}/index.html">{e(dom_court(d, langue))}</a><span>/</span><span>{e(code)}</span></nav>'
        f'<div class="page-head"><span class="eyebrow">{t["module"]}</span><h1>{e(nom)}</h1>'
        f'<p class="en">{e(mod_sous(m, langue))}</p></div>'
        f'<ol class="seas">{"".join(lignes)}</ol></main>')


def config_supabase(env=None) -> dict:
    """Public Supabase settings, from the SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY variables (GitHub Actions).

    Only the project URL and the publishable key may reach the browser. A secret or service_role key stops the build.
    """
    env = os.environ if env is None else env
    url, cle = env.get("SUPABASE_URL", "").strip(), env.get("SUPABASE_PUBLISHABLE_KEY", "").strip()
    if not url and not cle:
        return {}
    if not re.fullmatch(r"https://[a-z0-9]{20}\.supabase\.co", url):
        sys.exit("SUPABASE_URL doit être de la forme https://<ref>.supabase.co")
    if cle.startswith("sb_secret_") or "service_role" in cle or not cle.startswith("sb_publishable_"):
        sys.exit("SUPABASE_PUBLISHABLE_KEY doit être la clé publique sb_publishable_…, jamais une clé secrète.")
    return {"url": url, "key": cle}


def chemins(chemin: str, langue: str) -> tuple[str, str, str]:
    """For a page at <chemin>/ in <langue>: (base to the site root for assets, root of this language, same page in the other language)."""
    parties = [p for p in chemin.split("/") if p]
    profondeur = len(parties) + (1 if langue == "en" else 0)
    base = "../" * profondeur
    racine = base + ("en/" if langue == "en" else "")
    autre = base + ("" if langue == "en" else "en/") + (chemin + "/" if chemin else "") + "index.html"
    return base, racine, autre


def construire() -> None:
    erreurs = verifier_depot()
    if erreurs:
        sys.exit("\n".join(erreurs))
    parcours = charger_parcours()
    if SORTIE.exists():
        shutil.rmtree(SORTIE)
    shutil.copytree(SITE / "assets", SORTIE / "assets")
    shutil.copytree(SITE / "vendor", SORTIE / "assets" / "vendor")
    (SORTIE / "assets" / "config.js").write_text(
        "window.PA_CONFIG = " + json.dumps(config_supabase()) + ";\n", encoding="utf-8")
    g_seance = Template((SITE / "gabarits" / "seance.html").read_text(encoding="utf-8"))
    g_page = Template((SITE / "gabarits" / "page.html").read_text(encoding="utf-8"))

    for langue in LANGUES:
        t = TXT[langue]
        sortie = SORTIE if langue == "fr" else SORTIE / langue
        infos = {}
        for dom, m, sid in seances(parcours):
            s = charger_seance(sid, langue)
            infos[sid] = s
            base, racine, autre = chemins(sid, langue)
            donnees = dict(s, accueil=racine + "index.html", module_url=racine + m["id"] + "/index.html",
                           module_titre=mod_titre(m, langue), domaine_titre=dom_titre(dom, langue))
            page = g_seance.substitute(
                titre=e(s["titre"]), site_title=e(titre_site(langue)), marque=marque(racine, langue, base), favicon=base + favicon_url(langue), base=base, accueil=donnees["accueil"], lang=langue, autre=autre,
                bascule=bascule(langue, autre), alt_fr=base + sid + "/index.html", alt_en=base + "en/" + sid + "/index.html", compte=t["compte"], racine=racine,
                progression=t["progression"], etapes=t["etapes"],
                donnees=json.dumps(donnees, ensure_ascii=False).replace("</", "<\\/"))
            cible = sortie / sid / "index.html"
            cible.parent.mkdir(parents=True, exist_ok=True)
            cible.write_text(page, encoding="utf-8")
        plan = plan_json(parcours, {sid: (len(s["etapes"]), s["titre"]) for sid, s in infos.items()})
        titres = {sid: (len(s["etapes"]), s["titre"]) for sid, s in infos.items()}

        def ecrire(chemin, titre, description, contenu, actif="", classe=""):
            base, racine, autre = chemins(chemin, langue)
            cible = (sortie / chemin / "index.html") if chemin else sortie / "index.html"
            cible.parent.mkdir(parents=True, exist_ok=True)
            cible.write_text(g_page.substitute(
                titre=e(titre), description=e(description), favicon=base + favicon_url(langue), base=base, classe=classe, plan=plan, lang=langue,
                alt_fr=base + (chemin + "/" if chemin else "") + "index.html",
                alt_en=base + "en/" + (chemin + "/" if chemin else "") + "index.html",
                entete=entete(parcours, racine, autre, langue, actif, base), contenu=contenu,
                pied=pied(parcours, racine, autre, langue, base)), encoding="utf-8")

        nom_site = titre_site(langue)
        ecrire("", nom_site, parcours["sous_titre"] if langue == "fr" else parcours["sous_titre_en"],
               page_accueil(parcours, titres, langue), classe="accueil")
        for k, d in enumerate(parcours["domaines"], 1):
            ecrire(d["id"], f'{dom_titre(d, langue)} · {nom_site}', dom_accroche(d, langue), page_domaine(parcours, d, k, langue), actif=d["id"])
            for m in d["modules"]:
                if m.get("seances"):
                    ecrire(m["id"], f'{mod_titre(m, langue)} · {nom_site}', mod_sous(m, langue), page_module(d, m, infos, langue), actif=d["id"])
        compte = (SITE / "gabarits" / ("compte.html" if langue == "fr" else "compte.en.html")).read_text(encoding="utf-8")
        ecrire("compte", f'{t["compte"]} · {nom_site}', t["compte_desc"], compte)
    (SORTIE / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Site construit dans {SORTIE}")


def main(argv: list[str] | None = None) -> int:
    """Run canonical validation only, or build the bilingual static site."""
    args = sys.argv[1:] if argv is None else argv
    if "--verifier" in args:
        errors = verifier_depot()
        if errors:
            print("\n".join(errors), file=sys.stderr)
            return 1
        print("Course plan and referenced sessions are structurally valid.")
        return 0
    construire()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
