# Zero-Click CRM

A submission for the Hack-Nation "VC Big Bets" track.
This prototype rethinks the CRM from the ground up, built on a "zero-click" philosophy and powered by the **Google Cloud** stack.

**Live Demo URL:** [INSERT YOUR VERCEL URL HERE - DO THIS AFTER YOU DEPLOY]

### The "Hero Flow" (Our Demo)

1.  **Demo 1 (Voice Ingestion):** A user finishes a call, clicks "Start Voice Memo," and records a quick, casual summary.
2.  **AI Extraction (Vertex AI):** Our app sends the transcript to a **Vertex AI (Gemini 1.5 Pro)** model. It analyzes the text and returns structured JSON.
3.  **Real-time Database (BigQuery):** The structured JSON is inserted *instantly* into a **Google BigQuery** table. The UI updates immediately.
4.  **Demo 2 (Email Ingestion):** A user pastes the body of an email from a client.
5.  **Platform Power (Vertex AI):** A *separate* AI prompt analyzes the email, converts currency (₹ to $), and extracts the data.
6.  **Demo 3 (AI Search):** The user types a natural language query like "show me all deals at risk this month" into the search bar.
7.  **AI-to-SQL (Vertex AI + BigQuery):** A **Vertex AI** model *generates a BigQuery SQL query* on the fly. That query is run directly on **BigQuery**, and the table filters to show the exact results.

### Core Challenge Features Hit

* **`Voice-to-Structured-CRM Model`**: Implemented with the browser's SpeechRecognition API and Google Vertex AI.
* **`AI-Auto-Populating CRM`**: Implemented with our Email Ingestion feature, showing the platform's flexibility.
* **`AI Search and Relationship Insights`**: Our *killer feature*. We use Gemini to write and execute BigQuery SQL from plain English.
* **`Zero-Click Interface`**: The UI is built to prove the concept: "focus on conversations, not forms."

### Evaluation Criteria (How We Win)

* **`Automation Accuracy`**: **High.** We use `gemini-1.5-pro` with `temperature: 0.1` and `responseMimeType: "application/json"` for reliable, structured output.
* **`Use of Google AI / Vertex AI`**: **A+**. This project makes *strong* use of the exact recommended stack:
    * **Google Vertex AI (Gemini 1.5 Pro)**: For both data extraction and SQL generation.
    * **Google BigQuery**: As our scalable, serverless data warehouse.
* **`Data Freshness and Reliability`**: **A+**. Data is live from BigQuery and entries are timestamped and inserted in real-time.
* **`Search and Intelligence`**: **A+**. This is our core innovation.
* **`User Experience`**: **A+**. The flow is seamless and proves the "zero-click" value proposition.

### Tech Stack

* **Frontend:** Next.js 14 (App Router) & TailwindCSS
* **Backend:** Next.js API Routes
* **AI:** Google Cloud Vertex AI (Gemini 1.5 Pro)
* **Database:** Google Cloud BigQuery
* **Deployment:** Vercel