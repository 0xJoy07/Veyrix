from langchain_core.messages import AIMessage
from agent.agent import ShoppingAgent
from tools import build_tools

class FakeModel:
    def __init__(self):
        self.calls = 0
    def bind_tools(self, tools):
        return self
    def invoke(self, messages):
        self.calls += 1
        if self.calls == 1:
            return AIMessage(content='', tool_calls=[{'name':'search_products','args':{'query':'shoes'},'id':'call1','type':'tool_call'}])
        assert 'Walking shoes' in messages[-1].content
        return AIMessage(content='Walking shoes cost INR 125.00.')

def test_agent_tool_roundtrip(runtime, session):
    agent = ShoppingAgent(runtime, FakeModel())
    assert '125.00' in agent.chat(session.id, 'Find shoes')
    assert len(session.history) == 2

def test_model_cannot_confirm(runtime, session):
    assert not any('confirm' in tool.name for tool in build_tools(runtime, session))

def test_provider_failure(runtime, session):
    class Broken(FakeModel):
        def invoke(self, messages):
            raise RuntimeError('secret-key-not-for-output')
    result = ShoppingAgent(runtime, Broken()).chat(session.id, 'hello')
    assert 'unavailable' in result and 'secret-key' not in result
