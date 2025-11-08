"use client";

import { useState, useEffect, useRef } from "react";

// 1. DEFINE OUR CRM DATA TYPE (must match the BigQuery schema)
interface CrmEntry {
  contact_name: string;
  company_name: string;
  deal_value_usd: number;
  sentiment: string;
  next_step: string;
  follow_up_date: any; // BigQuery date can be object { value: '...' }
  full_summary: string;
  at_risk: boolean;
  transcript: string;
  created_at: any; // BigQuery timestamp can be object { value: '...' }
}

// 2. THE MAIN APP COMPONENT
export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false); // For AI
  const [isSearching, setIsSearching] = useState(false); // For Search
  const [searchQuery, setSearchQuery] = useState("");
  const [crmEntries, setCrmEntries] = useState<CrmEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For initial load

  // --- NEW STATE FOR EMAIL ---
  const [emailBody, setEmailBody] = useState("");
  const [isProcessingEmail, setIsProcessingEmail] = useState(false);
  // ---------------------------

  const recognitionRef = useRef<any>(null);

  // 3. LOAD DATA FROM OUR "DATABASE" (BigQuery via API) ON STARTUP
  const fetchEntries = async () => {
    setIsLoading(true);
    setSearchQuery(""); // Clear search query
    try {
      const response = await fetch("/api/get-entries");
      const data = await response.json();
      if (response.ok) {
        setCrmEntries(data);
      } else {
        throw new Error(data.error || "Failed to fetch entries");
      }
    } catch (error) {
      console.error(error);
      alert(`Error fetching entries: ${error}`);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchEntries(); // Load data on startup

    // Setup the SpeechRecognition API
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: any) => {
          const lastResult = event.results[event.results.length - 1];
          if (lastResult.isFinal) {
            setTranscript((prev) => prev + lastResult[0].transcript + " ");
          }
        };
        recognitionRef.current = recognition;
      } else {
        console.error("SpeechRecognition API not supported in this browser.");
      }
    }
  }, []);


  // 4. THE "HERO FLOW" LOGIC
  const toggleRecording = () => {
    if (isRecording) {
      // STOP recording
      recognitionRef.current?.stop();
      setIsRecording(false);
      // After stopping, process the final transcript
      if (transcript.trim()) {
        processTranscript(transcript.trim());
      }
    } else {
      // START recording
      if (recognitionRef.current) {
        setTranscript(""); // Clear old transcript
        recognitionRef.current.start();
        setIsRecording(true);
      } else {
        alert("Speech recognition is not supported or enabled in your browser.");
      }
    }
  };

  // 4b. PROCESS TRANSCRIPT (via our new Vertex/BigQuery API)
  const processTranscript = async (textToProcess: string) => {
    setIsProcessing(true);
    try {
      // Call our "Brain" API route
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: textToProcess }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`API Error: ${err.details || err.error}`);
      }

      const newEntry: CrmEntry = await response.json();
      
      // Add the new entry to the top of our list
      setCrmEntries((prevEntries) => [newEntry, ...prevEntries]);
      setTranscript(""); // Clear transcript after success

    } catch (error) {
      console.error("Error processing transcript:", error);
      alert(`Error: ${error}`);
    }
    setIsProcessing(false);
  };

  // 5. NEW "AI SEARCH" LOGIC
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchEntries(); // Clear search and reload all
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`Search API Error: ${err.details || err.error}`);
      }

      const results: CrmEntry[] = await response.json();
      setCrmEntries(results); // Replace entries with search results

    } catch (error) {
      console.error("Error searching:", error);
      alert(`Error: ${error}`);
    }
    setIsSearching(false);
  };

  // 6. --- NEW "EMAIL INGESTION" LOGIC ---
  const processEmail = async () => {
    if (!emailBody.trim()) {
      alert("Please paste an email body first.");
      return;
    }
    
    setIsProcessingEmail(true);
    try {
      const response = await fetch("/api/ingest-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailBody: emailBody }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`API Error: ${err.details || err.error}`);
      }

      const newEntry: CrmEntry = await response.json();
      
      // Add the new entry to the top of our list
      setCrmEntries((prevEntries) => [newEntry, ...prevEntries]);
      setEmailBody(""); // Clear textbox after success

    } catch (error) {
      console.error("Error processing email:", error);
      alert(`Error: ${error}`);
    }
    setIsProcessingEmail(false);
  };
  // ------------------------------------

  // Helper to format BigQuery values
  const formatValue = (value: any) => {
    if (value && typeof value === 'object' && value.value) { 
      // BigQuery dates/timestamps are { value: '...' }
      return new Date(value.value).toLocaleString('en-IN'); // Use Indian locale
    }
    if (typeof value === 'boolean') {
      return value ? "Yes" : "No";
    }
    if (typeof value === 'number') {
      return `₹${value.toLocaleString('en-IN')}`; // Use Rupees
    }
    return value || "N/A";
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-4">Zero-Click CRM</h1>
      <p className="text-xl text-gray-400 mb-8">
        Your AI Sidekick (Powered by Vertex AI + BigQuery)
      </p>

      {/* --- RECORDING BUTTON --- */}
      <button
        onClick={toggleRecording}
        disabled={isProcessing || isProcessingEmail}
        className={`px-12 py-6 rounded-full text-2xl font-semibold text-white transition-all
          ${(isProcessing || isProcessingEmail) ? "bg-gray-500" : ""}
          ${!isProcessing && isRecording ? "bg-red-600 hover:bg-red-700 animate-pulse" : ""}
          ${!isProcessing && !isRecording && !isProcessingEmail ? "bg-blue-600 hover:bg-blue-700" : ""}
        `}
      >
        {isProcessing
          ? "🧠 Analyzing Voice..."
          : isRecording
          ? "Stop Recording"
          : "🎙️ Start Voice Memo"}
      </button>

      {/* --- NEW: EMAIL INGESTION UI --- */}
      <div className="w-full max-w-4xl mt-12">
        <p className="text-gray-400 mb-2">
          ...or paste an email body to ingest:
        </p>
        <textarea
          value={emailBody}
          onChange={(e) => setEmailBody(e.target.value)}
          placeholder="Paste a raw email here... (e.g., 'From: client@example.com... Subject: Deal... Hi Birajit, We are interested in the ₹80,000 deal...')"
          className="w-full min-h-[150px] bg-gray-800 p-4 rounded-md border border-gray-700 text-gray-300"
        />
        <button
          onClick={processEmail}
          disabled={isProcessingEmail || isRecording || isProcessing}
          className="px-12 py-4 mt-4 rounded-md text-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-all disabled:bg-gray-500"
        >
          {isProcessingEmail ? "🧠 Analyzing Email..." : "📧 Process Email"}
        </button>
      </div>
      {/* --- END OF NEW UI --- */}

      {/* --- TRANSCRIPT BOX --- */}
      <div className="w-full max-w-4xl mt-8">
        <p className="text-gray-400">Live Transcript:</p>
        <div className="w-full min-h-[100px] bg-gray-800 p-4 rounded-md border border-gray-700 text-gray-300">
          {transcript || (
            <span className="text-gray-500">
              {isRecording ? "Listening..." : "Click 'Start' to talk..."}
            </span>
          )}
        </div>
      </div>

      {/* --- NEW: AI SEARCH BAR --- */}
      <div className="w-full max-w-6xl mt-12">
        <h2 className="text-3xl font-semibold mb-4">AI Relationship Search</h2>
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g., 'deals at risk' or 'who works at Cyberdyne?'"
            className="flex-grow p-4 rounded-md bg-gray-800 text-white border border-gray-700"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-md font-semibold disabled:bg-gray-500"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
          <button
            type="button"
            onClick={fetchEntries} // Reset button
            className="px-8 py-4 bg-gray-600 hover:bg-gray-700 rounded-md font-semibold"
          >
            Clear
          </button>
        </form>
      </div>


      {/* --- CRM TABLE --- */}
      <div className="w-full max-w-6xl mt-12">
        <h2 className="text-3xl font-semibold mb-4">CRM Entries (Live from BigQuery)</h2>
        <div className="overflow-x-auto shadow-lg rounded-lg">
          <table className="w-full min-w-full text-left bg-gray-800">
            <thead className="bg-gray-700 text-gray-300 uppercase text-sm">
              <tr>
                <th scope="col" className="px-6 py-3">Contact</th>
                <th scope="col" className="px-6 py-3">Company</th>
                <th scope="col" className="px-6 py-3">Deal Value</th>
                <th scope="col" className="px-6 py-3">Next Step</th>
                <th scope="col" className="px-6 py-3">At Risk?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Loading data from Google BigQuery...
                  </td>
                </tr>
              )}
              {!isLoading && crmEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    {searchQuery ? "No entries match your search." : "Your voice memos will appear here."}
                  </td>
                </tr>
              )}
              {!isLoading && crmEntries.map((entry, index) => (
                <tr key={index} className="hover:bg-gray-700">
                  <td className="px-6 py-4 font-medium">{formatValue(entry.contact_name)}</td>
                  <td className="px-6 py-4">{formatValue(entry.company_name)}</td>
                  <td className="px-6 py-4">
                    {formatValue(entry.deal_value_usd)}
                  </td>
                  <td className="px-6 py-4">{formatValue(entry.next_step)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs
                      ${entry.at_risk
                        ? "bg-red-800 text-red-200"
                        : "bg-green-800 text-green-200"}
                    `}>
                      {formatValue(entry.at_risk)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}