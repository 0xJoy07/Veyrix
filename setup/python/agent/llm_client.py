def make_model(config, secrets):
    from langchain_groq import ChatGroq
    if not secrets.get('groq_api_key') or not config.model.strip():
        raise ValueError('Set GROQ_API_KEY and a tool-capable GROQ_MODEL in the environment.')
    return ChatGroq(model=config.model, api_key=secrets.get('groq_api_key'), temperature=0,
                    timeout=30, max_retries=2, max_tokens=1500)
