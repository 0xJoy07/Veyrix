import pytest
from services.errors import describe_startup_error

@pytest.mark.parametrize('error, expected', [
    (ModuleNotFoundError('secret'), 'dependency is missing'),
    (OSError(98, 'secret'), 'already in use'),
    (PermissionError(13, 'secret'), 'denied access'),
    (OSError(99, 'secret'), 'SHOPPING_HOST'),
    (RuntimeError('secret'), 'RuntimeError'),
])
def test_safe_startup_guidance(error, expected):
    result = describe_startup_error(error)
    assert expected in result
    assert 'secret' not in result
