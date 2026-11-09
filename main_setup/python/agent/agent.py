import json
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from .prompts import SYSTEM
from .llm_client import make_model
from tools import build_tools
from memory.chat_memory import add_turn

class ShoppingAgent:
    def __init__(self, runtime, model=None):
        self.runtime = runtime
        self.model = model or make_model(runtime.config, runtime.secrets)

    def chat(self, session_id, text):
        if not text.strip() or len(text) > 8000:
            raise ValueError('Enter a message between 1 and 8000 characters.')
        session = self.runtime.sessions.get(session_id)
        with session.lock:
            tools = build_tools(self.runtime, session)
            lookup = {t.name: t for t in tools}
            model = self.model.bind_tools(tools)
            messages = [SystemMessage(content=SYSTEM.format(store=self.runtime.config.store_name, currency=self.runtime.config.currency))]
            messages += [(HumanMessage if role == 'human' else AIMessage)(content=value) for role, value in session.history]
            messages.append(HumanMessage(content=text))
            try:
                for _ in range(6):
                    response = model.invoke(messages)
                    messages.append(response)
                    if not response.tool_calls:
                        answer = response.content if isinstance(response.content, str) else json.dumps(response.content)
                        add_turn(session, text, answer)
                        return answer
                    for index, call in enumerate(response.tool_calls):
                        try:
                            if index >= 10:
                                raise ValueError('Too many tool calls in one turn. Narrow the request.')
                            result = lookup[call['name']].invoke(call['args'])
                        except ValueError as exc:
                            result = {'error': str(exc)}
                        except Exception:
                            result = {'error': 'This operation is unavailable. Check setup or try again.'}
                        messages.append(ToolMessage(content=json.dumps(result, default=str)[:20000], tool_call_id=call['id']))
                return 'The request needs too many steps. Please narrow your request.'
            except Exception:
                return 'The chat provider is unavailable. Check your model, credentials and connection, then retry.'
