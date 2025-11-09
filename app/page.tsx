"use client";

import { useState, useEffect } from "react";

// 1. DEFINE OUR CRM DATA TYPE
interface CrmEntry {
  contact_name: string;
  company_name: string;
  deal_value_usd: number;
  sentiment: string;
  next_step: string;
  follow_up_date: any;
  full_summary: string;
  at_risk: boolean;
  transcript: string;
  created_at: any;
}

// 2. THE MAIN APP COMPONENT
export default function Home() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [crmEntries, setCrmEntries] = useState<CrmEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 3. LOAD DATA FROM BIGQUERY
  const fetchEntries = async (isRefreshing = false) => {
    if (!isRefreshing) setIsLoading(true);
    setSearchQuery("");
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
    if (!isRefreshing) setIsLoading(false);
  };

  // Load data on startup
  useEffect(() => {
    fetchEntries();
  }, []);

  // 4. --- NEW "ENTERPRISE UPLOAD" LOGIC ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select an audio file first.");
      return;
    }

    setUploading(true);
    try {
      // 1. Get the secure signed URL from our API
      const response = await fetch("/api/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileType: selectedFile.type,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`Failed to get upload URL: ${err.details || err.error}`);
      }
      
      const { url } = await response.json();

      // 2. Upload the file *directly* to Google Cloud Storage
      await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type,
        },
        body: selectedFile,
      });

      alert("✅ File uploaded successfully! \n\nThe AI is processing it now. Click 'Refresh' in 1-2 minutes to see the new entry.");
      setSelectedFile(null); // Clear the file input
      // Clear the file input element itself
      (document.getElementById('file-upload') as HTMLInputElement).value = "";

    } catch (error) {
      console.error("Error uploading file:", error);
      alert(`❌ Error uploading file: ${error}`);
    }
    setUploading(false);
  };
  // ------------------------------------
  
  // 5. "AI SEARCH" LOGIC
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchEntries();
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
      setCrmEntries(results);
    } catch (error) {
      console.error("Error searching:", error);
      alert(`Error: ${error}`);
    }
    setIsSearching(false);
  };

  // 6. Helper to format BigQuery values
  const formatValue = (value: any) => {
    if (value && typeof value === 'object' && value.value) { 
      // BigQuery dates/timestamps are { value: '...' }
      return new Date(value.value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    }
    if (typeof value === 'boolean') {
      return value ? "Yes" : "No";
    }
    if (typeof value === 'number') {
      return `₹${value.toLocaleString('en-IN')}`;
    }
    return value || "N/A";
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-4">Zero-Click CRM</h1>
      <p className="text-xl text-gray-400 mb-8">
        The Enterprise AI Sidekick (Google Cloud Native)
      </p>

      {/* --- NEW UPLOAD UI --- */}
      <div className="w-full max-w-2xl p-8 bg-gray-800 rounded-lg border border-gray-700 shadow-xl">
        <h2 className="text-2xl font-semibold mb-4 text-center">
          Ingest a New Recording
        </h2>
        <p className="text-center text-gray-400 mb-6">
          Upload a call recording (.mp3, .wav, .m4a) from Zoom or WhatsApp.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            id="file-upload"
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-400
              file:mr-4 file:py-3 file:px-6
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-purple-600 file:text-white
              hover:file:bg-purple-700"
          />
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="px-8 py-3 rounded-full text-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition-all disabled:bg-gray-500 disabled:opacity-70"
          >
            {uploading ? "Uploading..." : "🚀 Ingest File"}
          </button>
        </div>
      </div>

      {/* --- AI SEARCH BAR --- */}
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
            onClick={() => fetchEntries(true)} // Refresh button
            className="px-8 py-4 bg-gray-600 hover:bg-gray-700 rounded-md font-semibold"
          >
            Refresh
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
                <th scope="col" className="px-6 py-3">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading data from Google BigQuery...
                  </td>
                </tr>
              )}
              {!isLoading && crmEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {searchQuery ? "No entries match your search." : "Upload an audio file to begin."}
                  </td>
                </tr>
              )}
              {!isLoading && crmEntries.map((entry, index) => (
                <tr key={index} className="hover:bg-gray-700">
                  <td className="px-6 py-4 font-medium">{formatValue(entry.contact_name)}</td>
                  <td className="px-6 py-4">{formatValue(entry.company_name)}</td>
                  <td className.="px-6 py-4">
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
                  <td className="px-6 py-4 text-sm text-gray-400">{formatValue(entry.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
