API deploy & setup

1) Purpose
--
This folder contains `api/explain.ts` — a Vercel serverless endpoint that receives scraped Power BI text and calls OpenAI to produce a strict JSON explanation. The endpoint enforces a server-side system prompt (prevents prompt injection) and uses `gpt-4o-mini`.

2) Environment
--
Set the following environment variable in your Vercel project (or local env for testing):

- `OPENAI_API_KEY` — your OpenAI secret key

3) Deploy
--
Place the `api` folder at the root of a Vercel/Next.js project and deploy to Vercel. Vercel will expose the function at `https://<your-deploy>.vercel.app/api/explain`.

4) Request contract
--
POST JSON body: { "text": "<dashboard text extracted by extension>" }

Response (success):
{ "success": true, "result": { "explanation": string, "verifiable": boolean, "citations": string[] } }

If the model does not return valid JSON, the API will respond with success:false and the raw output for debugging.

5) Notes and hardening
--
- The server ignores any `system_prompt` sent by the client and always uses the hard-coded `SYSTEM_PROMPT` to prevent prompt injection.
- Set `temperature` to `0.0` for deterministic replies.
- Keep `OPENAI_API_KEY` secret and use Vercel environment variables to store it.
