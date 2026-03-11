"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CrmEntry } from "@/app/lib/types";
import { ALLOWED_AUDIO_MIME_TYPES, MAX_UPLOAD_BYTES, UI_ALLOWED_EXTENSIONS } from "@/app/lib/upload";
import { formatIsoDate, formatMoneyUsd, formatText, formatTimestamp } from "@/app/lib/format";
import { Spinner } from "@/app/components/Spinner";

export default function Home() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [crmEntries, setCrmEntries] = useState<CrmEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [detailEntry, setDetailEntry] = useState<CrmEntry | null>(null);
  const [entriesLimit, setEntriesLimit] = useState(50);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<keyof CrmEntry>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedEntries = useMemo(() => {
    const entries = [...crmEntries];
    const dir = sortDir === "asc" ? 1 : -1;
    entries.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      if (typeof av === "boolean" && typeof bv === "boolean") return (Number(av) - Number(bv)) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return entries;
  }, [crmEntries, sortDir, sortKey]);

  const toggleSort = (key: keyof CrmEntry) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIndicator = (key: keyof CrmEntry) => {
    if (sortKey !== key) return null;
    return <span className="ml-2 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  const fetchEntries = useCallback(async (isRefreshing = false) => {
    if (!isRefreshing) setIsLoading(true);
    try {
      const response = await fetch(`/api/get-entries?limit=${entriesLimit}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch entries");
      setCrmEntries(data);
      setLastRefreshedAt(new Date());
    } catch (e) {
      console.error(e);
      setStatus(`Error fetching entries: ${String(e)}`);
    } finally {
      if (!isRefreshing) setIsLoading(false);
    }
  }, [entriesLimit]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const runSearch = useCallback(async (trimmed: string) => {
    setIsSearching(true);
    setStatus(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error || "Search failed");
      setCrmEntries(json);
    } catch (e) {
      console.error(e);
      setStatus(`Search error: ${String(e)}`);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const t = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 500);
    return () => window.clearTimeout(t);
  }, [runSearch, searchQuery]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    setStatus(null);
    if (!selectedFile) { setStatus("Select an audio file first."); return; }

    // Client-side guardrails
    if (!ALLOWED_AUDIO_MIME_TYPES.has(selectedFile.type)) {
      setStatus(`Unsupported file type. Use ${UI_ALLOWED_EXTENSIONS.join(", ")}.`);
      return;
    }
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setStatus("File too large (>50MB).");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const res = await fetch("/api/get-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileType: selectedFile.type, originalName: selectedFile.name, fileSize: selectedFile.size })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error || "Failed to get upload URL");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", json.url);
        xhr.setRequestHeader("Content-Type", selectedFile.type);
        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return;
          setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) return resolve();
          reject(new Error(`Signed upload failed (HTTP ${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Signed upload failed (network error)"));
        xhr.send(selectedFile);
      });

      setStatus("Uploaded. The AI pipeline is processing it; refresh in a few seconds.");
      setSelectedFile(null);
      const el = document.getElementById("file-upload") as HTMLInputElement | null;
      if (el) el.value = "";
      window.setTimeout(() => fetchEntries(true), 5000);
    } catch (e) {
      console.error(e);
      setStatus(`Upload error: ${String(e)}`);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) { fetchEntries(); return; }
    await runSearch(searchQuery.trim());
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 text-white">
      <h1 className="text-5xl font-bold mb-2">Zero-Click CRM</h1>
      <p className="text-xl text-gray-400 mb-8">The Enterprise AI Sidekick (Google Cloud Native)</p>

      <div className="w-full max-w-2xl p-8 bg-gray-800 rounded-lg border border-gray-700 shadow-xl">
        <h2 className="text-2xl font-semibold mb-4 text-center">Ingest a New Recording</h2>
        <p className="text-center text-gray-400 mb-6">Upload a call recording ({UI_ALLOWED_EXTENSIONS.join(", ")}).</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            id="file-upload"
            type="file"
            accept={UI_ALLOWED_EXTENSIONS.join(",")}
            onChange={handleFileChange}
            aria-label="Upload audio file"
            className="block w-full text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-md file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700" />
          <button onClick={handleUpload} disabled={uploading || !selectedFile}
            className="px-8 py-3 rounded-full text-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition-all focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-500 disabled:opacity-70">
            {uploading ? "Uploading..." : "🚀 Ingest File"}
          </button>
        </div>
        {selectedFile && (
          <p className="mt-3 text-sm text-gray-300">
            Selected: <span className="font-medium">{selectedFile.name}</span> ({Math.ceil(selectedFile.size / 1024 / 1024)}MB)
          </p>
        )}
        {!selectedFile && !uploading && (
          <p className="mt-3 text-sm text-gray-400">No upload selected.</p>
        )}
        {uploading && uploadProgress !== null && (
          <div className="mt-3">
            <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-600" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="mt-1 text-xs text-gray-400">{uploadProgress}%</p>
          </div>
        )}
        {status && <p className="mt-3 text-sm text-gray-300">{status}</p>}
      </div>

      <div className="w-full max-w-6xl mt-12">
        <h2 className="text-3xl font-semibold mb-4">AI Relationship Search</h2>
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g., deals at risk in last 30 days"
            aria-label="CRM search query"
            className="flex-grow p-4 rounded-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button type="submit" disabled={isSearching} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-gray-500">
            {isSearching ? <Spinner label="Searching" /> : "Search"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatus(null);
              fetchEntries(true);
            }}
            disabled={!searchQuery.trim() || isSearching}
            className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-800 disabled:text-gray-500"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => fetchEntries(true)}
            disabled={isLoading || isSearching}
            className="px-8 py-4 bg-gray-600 hover:bg-gray-700 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-800 disabled:text-gray-500"
          >
            Refresh
          </button>
        </form>
      </div>

      <div className="w-full max-w-6xl mt-12">
        <div className="flex items-end justify-between gap-6 mb-4">
          <h2 className="text-3xl font-semibold">CRM Entries (Live from BigQuery)</h2>
          <p className="text-sm text-gray-400">
            Last refreshed: {lastRefreshedAt ? lastRefreshedAt.toLocaleString() : "—"}
          </p>
        </div>
        <div className="overflow-x-auto shadow-lg rounded-lg">
          <table className="w-full min-w-full text-left bg-gray-800">
            <thead className="bg-gray-700 text-gray-300 uppercase text-sm">
              <tr>
                <th className="px-6 py-3">
                  <button type="button" className="hover:text-white" onClick={() => toggleSort("contact_name")}>
                    Contact{sortIndicator("contact_name")}
                  </button>
                </th>
                <th className="px-6 py-3">
                  <button type="button" className="hover:text-white" onClick={() => toggleSort("company_name")}>
                    Company{sortIndicator("company_name")}
                  </button>
                </th>
                <th className="px-6 py-3">
                  <button type="button" className="hover:text-white" onClick={() => toggleSort("deal_value_usd")}>
                    Deal Value (USD){sortIndicator("deal_value_usd")}
                  </button>
                </th>
                <th className="px-6 py-3">
                  <button type="button" className="hover:text-white" onClick={() => toggleSort("sentiment")}>
                    Sentiment{sortIndicator("sentiment")}
                  </button>
                </th>
                <th className="px-6 py-3">Next Step</th>
                <th className="px-6 py-3">
                  <button type="button" className="hover:text-white" onClick={() => toggleSort("follow_up_date")}>
                    Follow Up{sortIndicator("follow_up_date")}
                  </button>
                </th>
                <th className="px-6 py-3">
                  <button type="button" className="hover:text-white" onClick={() => toggleSort("at_risk")}>
                    At Risk?{sortIndicator("at_risk")}
                  </button>
                </th>
                <th className="px-6 py-3">
                  <button type="button" className="hover:text-white" onClick={() => toggleSort("created_at")}>
                    Created At{sortIndicator("created_at")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <Spinner label="Loading from BigQuery" />
                </td></tr>
              )}
              {!isLoading && crmEntries.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  {searchQuery ? "No entries match your search." : "Upload an audio file to begin."}
                </td></tr>
              )}
              {!isLoading && sortedEntries.map((entry, i) => (
                <tr
                  key={`${entry.created_at ?? ""}::${entry.contact_name ?? ""}::${entry.company_name ?? ""}::${i}`}
                  className="hover:bg-gray-700 cursor-pointer"
                  onClick={() => setDetailEntry(entry)}
                >
                  <td className="px-6 py-4 font-medium">
                    <div className="max-w-56 truncate" title={entry.contact_name ?? ""}>
                      {formatText(entry.contact_name)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-56 truncate" title={entry.company_name ?? ""}>
                      {formatText(entry.company_name)}
                    </div>
                  </td>
                  <td className="px-6 py-4">{formatMoneyUsd(entry.deal_value_usd)}</td>
                  <td className="px-6 py-4">{formatText(entry.sentiment)}</td>
                  <td className="px-6 py-4">
                    <div className="max-w-72 truncate" title={entry.next_step ?? ""}>
                      {formatText(entry.next_step)}
                    </div>
                  </td>
                  <td className="px-6 py-4">{formatIsoDate(entry.follow_up_date)}</td>
                  <td className="px-6 py-4">
                    {entry.at_risk === null ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-700 text-gray-200">Unknown</span>
                    ) : (
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          entry.at_risk ? "bg-red-800 text-red-200" : "bg-green-800 text-green-200"
                        }`}
                      >
                        {entry.at_risk ? "Yes" : "No"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{formatTimestamp(entry.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={() => setEntriesLimit((v) => Math.min(200, v + 50))}
            disabled={isLoading || isSearching || entriesLimit >= 200}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-900 disabled:text-gray-500"
          >
            Load more
          </button>
        </div>
      </div>

      {detailEntry && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailEntry(null)}
        >
          <div
            className="w-full max-w-3xl bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <h3 className="text-xl font-semibold">{formatText(detailEntry.contact_name)}</h3>
                <p className="text-sm text-gray-400">
                  {formatText(detailEntry.company_name)} • {formatTimestamp(detailEntry.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailEntry(null)}
                className="px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-sm"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-1">Summary</h4>
                <p className="text-gray-200 whitespace-pre-wrap">{formatText(detailEntry.full_summary)}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-1">Transcript</h4>
                <pre className="text-gray-200 whitespace-pre-wrap text-sm bg-gray-950/40 border border-gray-800 rounded-md p-4 max-h-80 overflow-auto">
                  {formatText(detailEntry.transcript)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
