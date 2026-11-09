from langchain_core.tools import tool

def cart_tools(runtime, session):
    @tool
    def set_cart_quantity(product_id: str, quantity: int) -> list:
        """Set the total quantity of a cart item. Zero removes it. Does not place an order."""
        return runtime.cart.set_item(session, product_id, quantity)

    @tool
    def view_cart() -> list:
        """Show the customer's current cart and live prices."""
        return runtime.cart.view(session)
    return [set_cart_quantity, view_cart]
