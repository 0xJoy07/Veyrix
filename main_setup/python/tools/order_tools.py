from langchain_core.tools import tool

def order_tools(runtime, session):
    @tool
    def prepare_order(delivery_address: str) -> dict:
        """Prepare an order summary and confirmation ID. This does not place the order."""
        return runtime.orders.prepare(session, delivery_address)

    @tool
    def order_history(order_id: str = '') -> list:
        """Get only the current customer's orders, optionally filtered by order ID."""
        runtime.orders.require_write()
        return runtime.orders.accounts.orders(session.customer_id, order_id or None)

    @tool
    def prepare_cancellation(order_id: str) -> dict:
        """Prepare cancellation of an eligible customer order; explicit UI confirmation is still required."""
        return runtime.orders.prepare_cancel(session, order_id)
    return [prepare_order, order_history, prepare_cancellation]
