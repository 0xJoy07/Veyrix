"""Actionable backend errors without exposing driver messages or credentials."""
from sqlalchemy.exc import DBAPIError, NoSuchTableError


def describe_error(exc):
    original = exc.orig if isinstance(exc, DBAPIError) else exc
    message = str(original).lower()
    state = getattr(original, 'sqlstate', None)
    if isinstance(original, ImportError):
        return ('A required dependency is missing. Install requirements.txt using '
                'the same Python environment that launches the server, then restart it.')
    if state == '28P01' or 'password authentication failed' in message:
        return ('Database authentication failed. Check the username and database password. '
                'Enter the decoded password (%40 becomes @). For a Supabase session '
                'pooler, copy its username from Connect; it includes the project ID.')
    if state == '3D000' or ('database' in message and 'does not exist' in message):
        return ('Database name was not found. For Supabase, choose PostgreSQL and '
                'set SHOPPING_DB_DATABASE to postgres.')
    if any(value in message for value in ('getaddrinfo', 'could not translate host',
                                          'name or service not known', 'nodename nor servname')):
        return ('The database hostname could not be resolved. Check the host and network. '
                'Supabase direct hosts require IPv6 unless the IPv4 add-on is enabled. '
                'On an IPv4 network, use Connect > Session pooler and copy its exact '
                'host and username; use port 5432, database postgres and TLS require.')
    if any(value in message for value in ('network is unreachable', 'unreachable network',
                                          'no route to host', '10051')):
        return ('The database network is unreachable. For a Supabase direct connection '
                'on a network without IPv6, use Connect > Session pooler: copy its '
                'host and username, with port 5432, database postgres and TLS require.')
    if any(value in message for value in ('certificate verify failed', 'ssl error',
                                          'tls error', 'ssl connection', 'root certificate')):
        return ('The secure database connection failed. Check TLS mode and the CA '
                'certificate path. For Supabase use TLS require, or verify-full '
                'with the appropriate CA certificate.')
    if any(value in message for value in ('timeout', 'timed out', 'connection refused')):
        return ('The database server did not accept a connection. Check the host, port, '
                'project status and network restrictions. For Supabase on an IPv4 '
                'network, use the Session pooler connection settings.')
    if state == '42501' or 'permission denied' in message:
        return 'The database user lacks permission for this operation. Check its database and table permissions.'
    if isinstance(exc, NoSuchTableError) or state in ('42P01', '42703'):
        return 'The requested table or column was not found. Check the product table and catalog mapping.'
    if isinstance(exc, DBAPIError):
        return 'The database rejected the operation. Check its schema, user permissions and connection settings.'
    return ('Backend operation failed unexpectedly. Check the selected file format and installed '
            'dependencies. No successful result was confirmed.')


def describe_startup_error(exc):
    """Explain startup failures without printing credentials or driver URLs."""
    if isinstance(exc, ImportError):
        return ('A backend dependency is missing. Run the server with '
                'main_setup/python/.venv/Scripts/python.exe and install '
                'main_setup/python/requirements.txt using that same interpreter.')
    if isinstance(exc, OSError):
        code = getattr(exc, 'winerror', None) or exc.errno
        if code in (10048, 98, 48):
            return 'The server port is already in use. Stop the existing server or change SHOPPING_PORT in .env.'
        if code in (10013, 13):
            return 'Windows denied access to the server socket. Check port restrictions or choose another SHOPPING_PORT in .env.'
        if code in (10049, 99):
            return 'SHOPPING_HOST is not an address available on this computer. Use 127.0.0.1 for local access.'
    return f'Backend startup failed ({type(exc).__name__}). {describe_error(exc)}'
