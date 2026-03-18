"""Tests for Vaultrag."""
from src.core import Vaultrag
def test_init(): assert Vaultrag().get_stats()["ops"] == 0
def test_op(): c = Vaultrag(); c.search(x=1); assert c.get_stats()["ops"] == 1
def test_multi(): c = Vaultrag(); [c.search() for _ in range(5)]; assert c.get_stats()["ops"] == 5
def test_reset(): c = Vaultrag(); c.search(); c.reset(); assert c.get_stats()["ops"] == 0
def test_service_name(): c = Vaultrag(); r = c.search(); assert r["service"] == "vaultrag"
