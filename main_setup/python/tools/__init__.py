from tools.catalog_tools import catalog_tools
from tools.cart_tools import cart_tools
from tools.order_tools import order_tools
from tools.review_tools import review_tools
from tools.policy_tools import policy_tools

def build_tools(runtime, session):
    return (catalog_tools(runtime) + cart_tools(runtime, session) + order_tools(runtime, session)
            + review_tools(runtime) + policy_tools(runtime))
