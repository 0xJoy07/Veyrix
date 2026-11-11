import json

import pytest
from langchain_core.messages import AIMessage

from agent.agent import ShoppingAgent
from memory.chat_memory import add_turn
from tools import build_tools
from tools.memory_tools import memory_tools


def test_agent_recalls_preference_older_than_direct_context(runtime, session):
    add_turn(session, 'I prefer vegan leather for shoes.', 'I will keep that preference in mind.')
    for index in range(12):
        add_turn(session, f'Unrelated message {index}', 'Okay.')

    class RecallModel:
        calls = 0

        def bind_tools(self, tools):
            assert 'recall_session' in {tool.name for tool in tools}
            return self

        def invoke(self, messages):
            self.calls += 1
            if self.calls == 1:
                assert not any('vegan leather' in message.content for message in messages)
                return AIMessage(content='', tool_calls=[{
                    'name': 'recall_session', 'args': {'query': 'prefer'},
                    'id': 'recall1', 'type': 'tool_call',
                }])
            result = json.loads(messages[-1].content)
            assert any(row['role'] == 'human' and row['text'] == 'I prefer vegan leather for shoes.'
                       for row in result['matches'])
            return AIMessage(content='You said you prefer vegan leather for shoes.')

    answer = ShoppingAgent(runtime, RecallModel()).chat(session.id, 'What material did I prefer earlier?')
    assert 'vegan leather' in answer
    assert len(session.history) == 28


def test_recall_cannot_read_another_session(runtime, session):
    bob = runtime.sessions.get(runtime.sessions.create('bob'))
    add_turn(session, 'I prefer blue.', 'Understood.')
    add_turn(bob, 'My private preference is red.', 'Understood.')
    recall = next(tool for tool in build_tools(runtime, session) if tool.name == 'recall_session')
    assert recall.invoke({'query': 'private'})['matches'] == []
    result = recall.invoke({'query': ''})
    assert result['total_matches'] == 2
    assert all('red' not in match['text'] for match in result['matches'])


def test_recall_pages_and_bounds_excerpts(session):
    for index in range(6):
        add_turn(session, f'Preference {index}', 'Acknowledged.')
    recall = memory_tools(session)[0]
    result = recall.invoke({'query': 'preference', 'limit': 2})
    assert [row['message_index'] for row in result['matches']] == [10, 8]
    assert result['total_matches'] == 6 and result['next_offset'] == 2
    second = recall.invoke({'query': 'preference', 'offset': result['next_offset'], 'limit': 5})
    assert [row['message_index'] for row in second['matches']] == [6, 4, 2, 0]
    assert second['next_offset'] is None
    add_turn(session, 'x' * 1500 + 'distinctive preference' + 'y' * 1500, 'Okay.')
    excerpt = recall.invoke({'query': 'distinctive'})['matches'][0]
    assert len(excerpt['text']) <= 1000
    assert 'distinctive preference' in excerpt['text']
    assert excerpt['text_offset'] == 1350 and excerpt['truncated']


@pytest.mark.parametrize('args', [{'query': 'x' * 201}, {'offset': -1}, {'limit': 0}, {'limit': 6}])
def test_recall_rejects_unbounded_requests(session, args):
    with pytest.raises(ValueError):
        memory_tools(session)[0].invoke(args)


def test_provider_context_is_bounded_without_truncating_transcript(runtime, session):
    for index in range(15):
        add_turn(session, f'Turn {index}', 'a' * 9000)

    class InspectModel:
        def bind_tools(self, tools):
            return self

        def invoke(self, messages):
            assert len(messages) == 22  # System, 20 historical messages, current user.
            assert messages[1].content == 'Turn 5'
            assert len(messages[-2].content) == 8000
            assert messages[-1].content == 'Hello'
            return AIMessage(content='Hello back.')

    ShoppingAgent(runtime, InspectModel()).chat(session.id, 'Hello')
    assert len(session.history) == 32
    assert len(session.history[1][1]) == 9000


def test_closing_session_erases_recall_results(runtime, session):
    add_turn(session, 'Temporary preference', 'Okay.')
    recall = memory_tools(session)[0]
    runtime.sessions.close(session.id)
    assert recall.invoke({})['matches'] == []
