export function Spinner({ label }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-gray-400" role="status" aria-live="polite">
      <span className="h-4 w-4 rounded-full border-2 border-gray-600 border-t-gray-200 animate-spin" />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );
}

