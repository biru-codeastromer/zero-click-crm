"use client";
import { useState, useEffect } from "react";

interface CrmEntry {
  contact_name: string | null;
  company_name: string | null;
  deal_value_usd: number | null;
  sentiment: string | null;
  next_step: string | null;
  follow_up_date: string | null; // DATE as string
  full_summary: string | null;
  at_risk: boolean | null;
  transcript: string | null;
  created_at: string | Date | null; // TIMESTAMP
}

export default function Home() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [crmEntries, setCrmEntries] = useState<CrmEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchEntries = async (isRefreshing = false) => {
    if (!isRefreshing) setIsLoading(true);
    try {
      const response = await fetch("/api/get-entries");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch entries");
      setCrmEntries(data);
    } catch (e) {
      console.error(e);
      alert(`Error fetching entries: ${e}`);
    } finally {
      if (!isRefreshing) setIsLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) { alert("Please select an audio file first."); return; }

    // Client-side guardrails
    const allowed = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac", "audio/m4a", "audio/3gpp"];
    if (!allowed.includes(selectedFile.type)) {
      alert("Unsupported file type. Use mp3, wav, or m4a.");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      alert("File too large (>50MB).");
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileType: selectedFile.type, originalName: selectedFile.name })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error || "Failed to get upload URL");

      await fetch(json.url, {
        method: "PUT",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile
      });

      alert("✅ Uploaded. The AI pipeline is processing it. Click Refresh shortly.");
      setSelectedFile(null);
      const el = document.getElementById("file-upload") as HTMLInputElement | null;
      if (el) el.value = "";
    } catch (e) {
      console.error(e);
      alert(`❌ Upload error: ${e}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) { fetchEntries(); return; }
    setIsSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error || "Search failed");
      setCrmEntries(json);
    } catch (e) {
      console.error(e);
      alert(`Search error: ${e}`);
    } finally {
      setIsSearching(false);
    }
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === "") return "N/A";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return `$${value.toLocaleString("en-US")}`;
    // dates
    const maybeDate = typeof value === "string" ? value : (value?.value ?? "");
    if (maybeDate && /^\d{4}-\d{2}-\d{2}/.test(maybeDate)) return new Date(maybeDate).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    return String(value);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 text-white">
      <h1 className="text-5xl font-bold mb-2">Zero-Click CRM</h1>
      <p className="text-xl text-gray-400 mb-8">The Enterprise AI Sidekick (Google Cloud Native)</p>

      <div className="w-full max-w-2xl p-8 bg-gray-800 rounded-lg border border-gray-700 shadow-xl">
        <h2 className="text-2xl font-semibold mb-4 text-center">Ingest a New Recording</h2>
        <p className="text-center text-gray-400 mb-6">Upload a call recording (.mp3, .wav, .m4a).</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <input id="file-upload" type="file" accept="audio/*" onChange={handleFileChange}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700" />
          <button onClick={handleUpload} disabled={uploading || !selectedFile}
            className="px-8 py-3 rounded-full text-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition-all disabled:bg-gray-500 disabled:opacity-70">
            {uploading ? "Uploading..." : "🚀 Ingest File"}
          </button>
        </div>
      </div>

      <div className="w-full max-w-6xl mt-12">
        <h2 className="text-3xl font-semibold mb-4">AI Relationship Search</h2>
        <form onSubmit={handleSearch} className="flex gap-4">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g., deals at risk in last 30 days" className="flex-grow p-4 rounded-md bg-gray-800 text-white border border-gray-700" />
          <button type="submit" disabled={isSearching} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-md font-semibold disabled:bg-gray-500">
            {isSearching ? "Searching..." : "Search"}
          </button>
          <button type="button" onClick={() => fetchEntries(true)} className="px-8 py-4 bg-gray-600 hover:bg-gray-700 rounded-md font-semibold">
            Refresh
          </button>
        </form>
      </div>

      <div className="w-full max-w-6xl mt-12">
        <h2 className="text-3xl font-semibold mb-4">CRM Entries (Live from BigQuery)</h2>
        <div className="overflow-x-auto shadow-lg rounded-lg">
          <table className="w-full min-w-full text-left bg-gray-800">
            <thead className="bg-gray-700 text-gray-300 uppercase text-sm">
              <tr>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">Deal Value (USD)</th>
                <th className="px-6 py-3">Next Step</th>
                <th className="px-6 py-3">At Risk?</th>
                <th className="px-6 py-3">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Loading data from Google BigQuery...
                </td></tr>
              )}
              {!isLoading && crmEntries.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {searchQuery ? "No entries match your search." : "Upload an audio file to begin."}
                </td></tr>
              )}
              {!isLoading && crmEntries.map((entry, i) => (
                <tr key={i} className="hover:bg-gray-700">
                  <td className="px-6 py-4 font-medium">{formatValue(entry.contact_name)}</td>
                  <td className="px-6 py-4">{formatValue(entry.company_name)}</td>
                  <td className="px-6 py-4">{formatValue(entry.deal_value_usd)}</td>
                  <td className="px-6 py-4">{formatValue(entry.next_step)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${entry.at_risk ? "bg-red-800 text-red-200" : "bg-green-800 text-green-200"}`}>
                      {entry.at_risk ? "Yes" : "No"}
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
 