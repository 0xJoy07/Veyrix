import csv
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
from sqlalchemy import select
from db.models import products, reviews

def read_file(path):
    path = Path(path)
    if path.stat().st_size > 10 * 1024 * 1024:
        raise ValueError('Import files must be at most 10 MB.')
    with path.open(encoding='utf-8-sig', newline='') as stream:
        rows = json.load(stream) if path.suffix.lower() == '.json' else list(csv.DictReader(stream))
    if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows):
        raise ValueError('Expected a list of records.')
    return rows

def integer(value):
    parsed = Decimal(str(value))
    if not parsed.is_finite() or parsed != parsed.to_integral_value() or parsed < 0 or parsed > 2_000_000_000:
        raise ValueError('Expected a nonnegative whole number.')
    return int(parsed)

def import_records(engine, path, mapping=None, kind='products'):
    rows = read_file(path)
    clean, seen = [], set()
    for index, original in enumerate(rows, 1):
        try:
            row = {k: original[v] for k, v in mapping.items()} if mapping else original
            record_id = str(row['id']).strip()
            if not record_id or len(record_id) > 100 or record_id in seen:
                raise ValueError('Missing or duplicate ID.')
            seen.add(record_id)
            if kind == 'reviews':
                rating = integer(row['rating'])
                if not 1 <= rating <= 5:
                    raise ValueError('Rating must be 1 to 5.')
                clean.append(dict(id=record_id, product_id=str(row['product_id']), rating=rating, text=str(row['text'])))
            else:
                price = Decimal(str(row['price_minor'])) if 'price_minor' in row else Decimal(str(row['price'])) * 100
                name = str(row['name']).strip()
                if not name or len(name) > 250:
                    raise ValueError('Invalid product name.')
                clean.append(dict(id=record_id, name=name, price_minor=integer(price), stock=integer(row['stock']),
                    description=str(row.get('description', '')), category=str(row.get('category', ''))))
        except (KeyError, ValueError, InvalidOperation):
            raise ValueError(f'Invalid {kind} record at row {index}. Check required fields, amounts, and duplicate IDs.') from None
    table = reviews if kind == 'reviews' else products
    with engine.begin() as conn:
        existing = set(conn.execute(select(table.c.id)).scalars())
        if existing & seen:
            raise ValueError('Existing IDs found. Import rejected to protect live records and stock.')
        if clean:
            conn.execute(table.insert(), clean)
    return len(clean)
