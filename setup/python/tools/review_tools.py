from langchain_core.tools import tool

def review_tools(runtime):
    @tool
    def product_reviews(product_id: str) -> dict:
        """Read stored reviews and ratings for a specific product; never invent feedback."""
        return runtime.catalog.reviews(product_id)
    return [product_reviews]
