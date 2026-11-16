"""Groq model settings and reasoning-aware classification budgets."""
GPT_OSS_MODELS = {'openai/gpt-oss-20b', 'openai/gpt-oss-120b'}
NON_REASONING_MODELS = {'llama-3.1-8b-instant', 'llama-3.3-70b-versatile'}


def groq_model_options(model_id, reasoning_effort=None):
    """Never send provider-specific reasoning settings to an unsupported model."""
    effort = (reasoning_effort or '').strip()
    if effort and (model_id not in GPT_OSS_MODELS or effort not in {'low', 'medium', 'high'}):
        raise ValueError('GROQ_REASONING_EFFORT must be low, medium or high and requires a supported GPT-OSS model.')
    return {'reasoning_effort': effort or 'low'} if model_id in GPT_OSS_MODELS else {}


def scope_options(model):
    """Reasoning shares the completion budget; eight tokens is only safe for known non-reasoning models."""
    model_id = getattr(model, 'model_name', None) or getattr(model, 'model', '')
    if model_id in GPT_OSS_MODELS:
        return {'max_tokens': 512, 'reasoning_effort': 'low'}
    return {'max_tokens': 8 if model_id in NON_REASONING_MODELS else 512}


def make_model(config, secrets):
    from langchain_groq import ChatGroq
    if not secrets.get('groq_api_key') or not config.model.strip():
        raise ValueError('Set GROQ_API_KEY and a tool-capable GROQ_MODEL in the environment.')
    return ChatGroq(model=config.model, api_key=secrets.get('groq_api_key'), temperature=0,
                    timeout=30, max_retries=2, max_tokens=1500, **groq_model_options(config.model))
