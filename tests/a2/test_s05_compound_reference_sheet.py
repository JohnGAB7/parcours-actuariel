"""Numerical and bilingual checks for the A2/S05 compound aggregate loss reference sheet."""
from math import isclose, exp, sqrt
from pathlib import Path
import yaml

from tools.construire import charger_seance
from tools.validation_contenus import verifier_overlay_traduction

ROOT = Path(__file__).resolve().parents[2]


def test_a2_s05_reference_sheet_is_complete_and_bilingual():
    fr = charger_seance("a2/s05", "fr")
    en = charger_seance("a2/s05", "en")
    overlay = yaml.safe_load((ROOT / "contenus/en/a2/s05.yaml").read_text(encoding="utf-8"))
    assert fr["fiche"]["statut"] == "prete"
    assert len(fr["fiche"]["cours_complet"]["sections"]) == 7
    assert len(fr["fiche"]["methodes"]["methodes"]) == 3
    assert len(fr["fiche"]["exemples_guides"]["exemples"]) == 3
    assert len(fr["fiche"]["exercices_corriges"]["exercices"]) == 3
    assert not verifier_overlay_traduction(fr, overlay, session_id="a2/s05")
    assert en["fiche"]["cours_complet"]["sections"][0]["titre"] == "1. Random sum of severities"


def test_a2_s05_compound_moments_reconcile():
    lam,theta=50,2000
    ex=theta
    var_x=theta**2
    ex2=var_x+ex**2
    mean_s=lam*ex
    var_s=lam*ex2
    assert isclose(ex2,8_000_000,abs_tol=1e-12)
    assert isclose(mean_s,100_000,abs_tol=1e-12)
    assert isclose(var_s,400_000_000,abs_tol=1e-12)
    assert isclose(sqrt(var_s),20_000,abs_tol=1e-12)
    assert isclose(exp(-lam),1.9287498479639178e-22,rel_tol=1e-12)

    n,p,c=100,0.1,5000
    mean_n=n*p
    var_n=n*p*(1-p)
    mean_total=mean_n*c
    var_total=var_n*c**2
    assert isclose(mean_n,10,abs_tol=1e-12)
    assert isclose(var_n,9,abs_tol=1e-12)
    assert isclose(mean_total,50_000,abs_tol=1e-12)
    assert isclose(var_total,225_000_000,abs_tol=1e-12)
    assert isclose(sqrt(var_total),15_000,abs_tol=1e-12)

    ex_discrete=(1+2)/2
    ex2_discrete=(1+4)/2
    assert isclose(10*ex_discrete,15,abs_tol=1e-12)
    assert isclose(10*ex2_discrete,25,abs_tol=1e-12)


def test_a2_s05_exercises_and_lab_code():
    mean1=20*3000
    var1=20*3000**2
    assert isclose(mean1,60_000,abs_tol=1e-12)
    assert isclose(var1,180_000_000,abs_tol=1e-12)
    assert isclose(sqrt(var1),13416.407864998739,abs_tol=1e-9)

    mean2=50*0.1*1000
    var2=50*0.1*1_000_000+50*0.1*0.9*1000**2
    assert isclose(mean2,5000,abs_tol=1e-12)
    assert isclose(var2,9_500_000,abs_tol=1e-12)
    assert isclose(sqrt(var2),3082.207001484488,abs_tol=1e-9)
    assert isclose(exp(-10),0.00004539992976248485,abs_tol=1e-15)

    session=yaml.safe_load((ROOT/"contenus/a2/s05.yaml").read_text(encoding="utf-8"))
    app=session["fiche"]["applications_labs"]["applications"][0]
    block=next(item for item in app["procedure"] if "mean_s =" in item)
    fence=chr(96)*3
    code=block.split(fence+"python",1)[1].split(fence,1)[0].strip()
    namespace={}
    exec(compile(code,"a2_s05_reference_lab.py","exec"),namespace)
    assert isclose(namespace["mean_s"],100000,abs_tol=1e-12)
    assert isclose(namespace["var_s"],400000000,abs_tol=1e-12)
    assert isclose(namespace["sd_s"],20000,abs_tol=1e-12)
