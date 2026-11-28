"""Independent numerical checks for the A1/S05 bond reference sheet."""
from math import isclose
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]
SESSION = yaml.safe_load((ROOT / "contenus/a1/s05.yaml").read_text(encoding="utf-8"))


def bond_price(face, coupon_rate, n, y):
    coupon = face * coupon_rate
    return sum(coupon / (1 + y) ** t for t in range(1, n + 1)) + face / (1 + y) ** n


def test_price_yield_premium_par_discount_examples():
    assert isclose(bond_price(1000, 0.05, 5, 0.04), 1044.51822331016, rel_tol=1e-12)
    assert isclose(bond_price(1000, 0.05, 5, 0.05), 1000, abs_tol=1e-10)
    assert isclose(bond_price(1000, 0.05, 5, 0.06), 957.87636214434, rel_tol=1e-12)
    assert bond_price(1000, 0.05, 5, 0.04) > bond_price(1000, 0.05, 5, 0.06)


def test_spot_price_and_forward_rates():
    flows = {1: 50, 2: 50, 3: 1050}
    spot = [0.03, 0.035, 0.04]
    price = sum(cf / (1 + spot[t - 1]) ** t for t, cf in flows.items())
    f12 = (1 + spot[1]) ** 2 / (1 + spot[0]) - 1
    f23 = (1 + spot[2]) ** 3 / (1 + spot[1]) ** 2 - 1
    assert isclose(price, 1028.66540094317, rel_tol=1e-12)
    assert isclose(f12, 0.04002427184466, rel_tol=1e-12)
    assert isclose(f23, 0.05007258045695, rel_tol=1e-12)


def test_duration_convexity_and_second_order_approximation():
    face, coupon, n, y = 1000, 0.05, 5, 0.04
    cash = [face * coupon] * (n - 1) + [face * (1 + coupon)]
    pv = [cf / (1 + y) ** t for t, cf in enumerate(cash, 1)]
    price = sum(pv)
    macaulay = sum(t * x for t, x in enumerate(pv, 1)) / price
    modified = macaulay / (1 + y)
    convexity = sum(t * (t + 1) * x for t, x in enumerate(pv, 1)) / price / (1 + y) ** 2
    shock = 0.005
    approximation = -modified * shock + 0.5 * convexity * shock ** 2
    exact = sum(cf / (1 + y + shock) ** t for t, cf in enumerate(cash, 1)) / price - 1
    assert isclose(macaulay, 4.55708674166, rel_tol=1e-10)
    assert isclose(modified, 4.38181417468, rel_tol=1e-10)
    assert isclose(convexity, 24.47656941571, rel_tol=1e-10)
    assert abs(approximation - exact) < 1e-5


def test_reference_lab_code_is_valid_and_runs():
    app = SESSION["fiche"]["applications_labs"]["applications"][0]
    block = next(x for x in app["procedure"] if "face, coupon, n, y" in x)
    fence = chr(96) * 3
    code = block.split(fence + "python", 1)[1].split(fence, 1)[0].strip()
    compiled = compile(code, "a1_s05_reference_lab.py", "exec")
    namespace = {}
    exec(compiled, namespace)
    assert isclose(namespace["price"], 1044.51822331016, rel_tol=1e-12)
    assert isclose(namespace["spot_price"], 1024.57434500501, rel_tol=1e-12)
    assert len(namespace["forwards"]) == 5
    assert abs(namespace["approx_change"] - namespace["exact_change"]) < 1e-5


def test_a1_s05_convexity_approximations_match_the_sheet():
    flows = [50, 50, 50, 50, 1050]
    price = sum(c * 1.04 ** -(t + 1) for t, c in enumerate(flows))
    mac = sum((t + 1) * c * 1.04 ** -(t + 1) for t, c in enumerate(flows)) / price
    mod = mac / 1.04
    conv = sum((t + 1) * (t + 2) * c * 1.04 ** -(t + 3) for t, c in enumerate(flows)) / price
    assert round(100 * (-mod * 0.01 + 0.5 * conv * 0.01**2), 4) == -4.2594
    assert round(100 * (-4.3818 * 0.005 + 0.5 * 24.4766 * 0.005**2), 4) == -2.1603
    text = Path(ROOT / "contenus/a1/s05.yaml").read_text(encoding="utf-8")
    assert "−4,2594 %" in text and "−2,1603 %" in text
