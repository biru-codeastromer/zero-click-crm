"use client"; // This is CRITICAL for using React hooks and browser APIs

import { useState, useEffect, useRef } from "react";

// 1. DEFINE OUR CRM DATA TYPE (must match the AI prompt)
interface CrmEntry {
  contact_name: string;
  company_name: string;
  deal_value_usd: number;
  sentiment: string;
  next_step: string;
  follow_up_date: string;
  full_summary: string;
  at_risk: boolean;
}

// 2. THE MAIN APP COMPONENT
export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [crmEntries, setCrmEntries] = useState<CrmEntry[]>([]);

  // Refs to manage the browser's SpeechRecognition API
  const recognitionRef = useRef<any>(null);

  // 3. LOAD DATA FROM OUR "DATABASE" (localStorage) ON STARTUP
  useEffect(() => {
    const storedEntries = localStorage.getItem("crmEntries");
    if (storedEntries) {
      setCrmEntries(JSON.parse(storedEntries));
    }

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

  // 4. SAVE DATA TO OUR "DATABASE" (localStorage) ON CHANGE
  useEffect(() => {
    if (crmEntries.length > 0) {
      localStorage.setItem("crmEntries", JSON.stringify(crmEntries));
    }
  }, [crmEntries]);

  // 5. THE "HERO FLOW" LOGIC
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

  const processTranscript = async (textToProcess: string) => {
    setIsLoading(true);
    try {
      // Call our "Brain" API route
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: textToProcess }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${await response.text()}`);
      }

      const newEntry: CrmEntry = await response.json();
      
      // Add the new entry to our CRM
      setCrmEntries((prevEntries) => [newEntry, ...prevEntries]);
      setTranscript(""); // Clear transcript after success

    } catch (error) {
      console.error("Error processing transcript:", error);
      alert(`Error: ${error}`);
    }
    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-4">Zero-Click CRM</h1>
      <p className="text-xl text-gray-400 mb-8">
        Your AI Sales Team Sidekick
      </p>

      {/* --- RECORDING BUTTON --- */}
      <button
        onClick={toggleRecording}
        disabled={isLoading}
        className={`px-12 py-6 rounded-full text-2xl font-semibold text-white transition-all
          ${isLoading ? "bg-gray-500" : ""}
          ${!isLoading && isRecording ? "bg-red-600 hover:bg-red-700 animate-pulse" : ""}
          ${!isLoading && !isRecording ? "bg-blue-600 hover:bg-blue-700" : ""}
        `}
      >
        {isLoading
          ? "🧠 Thinking..."
          : isRecording
          ? "Stop Recording"
          : "🎙️ Start Voice Memo"}
      </button>

      {/* --- TRANSCRIPT BOX --- */}
      <div className="w-full max-w-4xl mt-8">
        <p className="text-gray-400">Transcript:</p>
        <div className="w-full min-h-[100px] bg-gray-800 p-4 rounded-md border border-gray-700 text-gray-300">
          {transcript || (
            <span className="text-gray-500">
              {isRecording ? "Listening..." : "Click 'Start' to talk..."}
            </span>
          )}
        </div>
      </div>

      {/* --- CRM TABLE --- */}
      <div className="w-full max-w-6xl mt-12">
        <h2 className="text-3xl font-semibold mb-4">CRM Entries</h2>
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
              {crmEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Your voice memos will appear here.
                  </td>
                </tr>
              )}
              {crmEntries.map((entry, index) => (
                <tr key={index} className="hover:bg-gray-700">
                  <td className="px-6 py-4 font-medium">{entry.contact_name}</td>
                  <td className="px-6 py-4">{entry.company_name}</td>
                  <td className="px-6 py-4">
                    {entry.deal_value_usd
                      ? `$${entry.deal_value_usd.toLocaleString()}`
                      d : "N/A"}
                  </td>
                  <td className="px-6 py-4">{entry.next_step}</td>
                  <td className="px-6 py-4">
                    {entry.at_risk ? (
                      <span className="px-2 py-1 bg-red-800 text-red-200 rounded-full text-xs">
                        Yes
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-800 text-green-200 rounded-full text-xs">
                        No
                      </span>
                    )}
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
