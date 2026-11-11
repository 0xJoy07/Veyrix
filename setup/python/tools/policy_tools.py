from langchain_core.tools import tool

def policy_tools(runtime):
    @tool
    def store_policy() -> dict:
        """Read store delivery and cancellation policy and pay-on-delivery terms."""
        return {'policy': runtime.config.policy, 'delivery_minor': runtime.config.delivery_minor,
                'currency': runtime.config.currency, 'payment_method': 'pay_on_delivery',
                'cancellable_statuses': ['confirmed', 'preparing']}
    return [store_policy]
