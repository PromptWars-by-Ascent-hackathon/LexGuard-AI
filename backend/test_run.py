import asyncio
import json
from pipeline.orchestrator import run_pipeline

async def main():
    text = "This is a simple non-disclosure agreement. Party A will not disclose secrets of Party B."
    
    async def cb(agent, msg):
        print(f"Agent {agent}: {msg}")
        
    result = await run_pipeline(text, "test-sess", "test.pdf", cb)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
