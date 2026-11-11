from langchain_core.tools import tool

def catalog_tools(runtime):
    @tool
    def search_products(query: str = '', max_price_minor: int | None = None) -> list:
        """Search current products. Price filters use minor currency units (paise for INR)."""
        return runtime.catalog.search(query, max_price_minor)

    @tool
    def product_details(product_id: str) -> dict:
        """Read current product details, price and stock by product ID."""
        return runtime.catalog.get(product_id)
    return [search_products, product_details]
