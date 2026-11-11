from decimal import Decimal
from sqlalchemy import MetaData, Table, select, or_, func
from db.models import reviews

class Catalog:
    def __init__(self, engine, config):
        self.engine, self.config = engine, config
        self.table = Table(config.product_table, MetaData(), autoload_with=engine)
        self.mapping = config.mapping or {key: key for key in ('id', 'name', 'price_minor', 'stock', 'description', 'category')}
        for required in ('id', 'name', 'stock'):
            if required not in self.mapping:
                raise ValueError('Mapping requires id, name, stock and price_minor or price.')
        if not {'price', 'price_minor'} & self.mapping.keys():
            raise ValueError('Map price (major units) or price_minor.')
        if any(value not in self.table.c for value in self.mapping.values()):
            raise ValueError('Mapped column does not exist.')

    def normalize(self, row):
        result = {key: row[value] for key, value in self.mapping.items()}
        result['id'] = str(result['id'])
        if 'price' in result:
            from db.importers.files import integer
            result['price_minor'] = integer(Decimal(str(result.pop('price'))) * 100)
        result['currency'] = self.config.currency
        return result

    def get(self, product_id):
        with self.engine.connect() as conn:
            row = conn.execute(select(self.table).where(self.table.c[self.mapping['id']] == product_id)).mappings().first()
        if row is None:
            raise ValueError('Product not found.')
        return self.normalize(row)

    def search(self, query='', max_price_minor=None):
        columns = [self.table.c[self.mapping[k]] for k in ('name', 'description', 'category') if k in self.mapping]
        statement = select(self.table).where(or_(*(c.ilike('%' + query.replace('%', '').replace('_', '') + '%') for c in columns)))
        if max_price_minor is not None:
            key = 'price_minor' if 'price_minor' in self.mapping else 'price'
            statement = statement.where(self.table.c[self.mapping[key]] <= (max_price_minor if key == 'price_minor' else Decimal(max_price_minor) / 100))
        with self.engine.connect() as conn:
            return [self.normalize(r) for r in conn.execute(statement.limit(30)).mappings()]

    def reviews(self, product_id):
        from sqlalchemy import inspect
        if not inspect(self.engine).has_table('reviews'):
            return {'reviews': [], 'average': None, 'note': 'Reviews unavailable.'}
        with self.engine.connect() as conn:
            rows = [dict(r) for r in conn.execute(select(reviews).where(reviews.c.product_id == product_id).limit(100)).mappings()]
            average, count = conn.execute(select(func.avg(reviews.c.rating), func.count()).where(reviews.c.product_id == product_id)).one()
        return {'reviews': rows, 'average': float(average) if average is not None else None, 'count': count,
                'note': 'Up to 100 review texts; rating average covers all stored reviews.'}
