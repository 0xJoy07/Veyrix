import pytest
from sqlalchemy.exc import OperationalError, NoSuchTableError
from setup_ui.errors import describe_error


@pytest.mark.parametrize('detail,expected', [
    ('failed to resolve host: getaddrinfo failed', 'hostname could not be resolved'),
    ('A socket operation was attempted to an unreachable network', 'network is unreachable'),
    ('password authentication failed', 'authentication failed'),
    ('database "missing" does not exist', 'Database name was not found'),
    ('SSL error: certificate verify failed', 'secure database connection failed'),
    ('connection timeout expired', 'did not accept a connection'),
    ('connection refused', 'did not accept a connection'),
    ('permission denied for table products', 'lacks permission'),
])
def test_driver_errors_are_actionable_and_private(detail, expected):
    secret = 'private-password-123'
    error = OperationalError('SELECT secret', {'password': secret}, Exception(detail + ' ' + secret))
    result = describe_error(error)
    assert expected in result
    assert secret not in result
    assert 'SELECT secret' not in result


def test_missing_dependency():
    assert 'same Python environment' in describe_error(ModuleNotFoundError('psycopg'))


def test_missing_table():
    assert 'table or column' in describe_error(NoSuchTableError('products'))


def test_unknown_error_does_not_echo_secrets():
    assert 'private-password' not in describe_error(RuntimeError('private-password'))
