import json
import pytest
from db.importers.files import import_records

def test_import_and_duplicate_rejection(runtime, tmp_path):
    path = tmp_path / 'products.json'
    path.write_text(json.dumps([dict(id='p3', name='Hat', price='12.50', stock=3)]))
    assert import_records(runtime.engine, path) == 1
    assert runtime.catalog.get('p3')['price_minor'] == 1250
    with pytest.raises(ValueError):
        import_records(runtime.engine, path)

def test_invalid_file_no_partial_import(runtime, tmp_path):
    path = tmp_path / 'products.json'
    path.write_text(json.dumps([dict(id='p3', name='Hat', price='12.50', stock=3), dict(id='p4', name='Bad', price='NaN', stock=0)]))
    with pytest.raises(ValueError):
        import_records(runtime.engine, path)
    with pytest.raises(ValueError):
        runtime.catalog.get('p3')

def test_csv_mapping(runtime, tmp_path):
    path = tmp_path / 'products.csv'
    path.write_text('sku,title,amount,qty\np3,Hat,2.50,5\n')
    assert import_records(runtime.engine, path, {'id':'sku','name':'title','price':'amount','stock':'qty'}) == 1

def test_review_import(runtime, tmp_path):
    path = tmp_path / 'reviews.json'
    path.write_text(json.dumps([dict(id='r1', product_id='p1', rating=4, text='Comfortable')]))
    import_records(runtime.engine, path, kind='reviews')
    assert runtime.catalog.reviews('p1')['average'] == 4
