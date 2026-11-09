from sqlalchemy import MetaData, Table, Column, String, Integer, Text, ForeignKey, CheckConstraint

metadata = MetaData()
products = Table('products', metadata,
    Column('id', String(100), primary_key=True), Column('name', String(250), nullable=False),
    Column('description', Text, nullable=False, default=''), Column('category', String(100), nullable=False, default=''),
    Column('price_minor', Integer, nullable=False), Column('stock', Integer, nullable=False),
    CheckConstraint('stock >= 0'), CheckConstraint('price_minor >= 0'))
customers = Table('customers', metadata, Column('id', String(100), primary_key=True), Column('name', String(250), nullable=False))
reviews = Table('reviews', metadata, Column('id', String(100), primary_key=True),
    Column('product_id', String(100), ForeignKey('products.id'), nullable=False),
    Column('rating', Integer, nullable=False), Column('text', Text, nullable=False), CheckConstraint('rating >= 1 AND rating <= 5'))
orders = Table('orders', metadata, Column('id', String(100), primary_key=True),
    Column('customer_id', String(100), ForeignKey('customers.id'), nullable=False),
    Column('request_id', String(100), unique=True, nullable=False), Column('status', String(30), nullable=False),
    Column('total_minor', Integer, nullable=False), Column('currency', String(3), nullable=False),
    Column('address', Text, nullable=False), Column('created_at', String(50), nullable=False),
    Column('payment_method', String(30), nullable=False, default='pay_on_delivery'))
order_items = Table('order_items', metadata, Column('id', String(100), primary_key=True),
    Column('order_id', String(100), ForeignKey('orders.id'), nullable=False),
    Column('product_id', String(100), ForeignKey('products.id'), nullable=False),
    Column('name', String(250), nullable=False), Column('quantity', Integer, nullable=False),
    Column('price_minor', Integer, nullable=False), CheckConstraint('quantity > 0'))
events = Table('order_events', metadata, Column('id', String(100), primary_key=True),
    Column('order_id', String(100), ForeignKey('orders.id'), nullable=False),
    Column('event', String(30), nullable=False), Column('created_at', String(50), nullable=False))
version = Table('shopping_schema', metadata, Column('version', Integer, primary_key=True))
