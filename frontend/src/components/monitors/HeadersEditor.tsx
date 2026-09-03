import { Plus, Trash2 } from "lucide-react";

export interface HeaderRow {
  id: string;
  key: string;
  value: string;
}

export function headersToRows(headers: Record<string, string>): HeaderRow[] {
  return Object.entries(headers).map(([key, value], index) => ({
    id: `${index}-${key}`,
    key,
    value,
  }));
}

export function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const row of rows) {
    if (row.key.trim()) headers[row.key.trim()] = row.value;
  }
  return headers;
}

export function HeadersEditor({
  rows,
  onChange,
}: {
  rows: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
}) {
  const update = (id: string, field: "key" | "value", value: string) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const remove = (id: string) => onChange(rows.filter((row) => row.id !== id));

  const add = () => onChange([...rows, { id: crypto.randomUUID(), key: "", value: "" }]);

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Header name"
            value={row.key}
            onChange={(e) => update(row.id, "key", e.target.value)}
            className="input-base"
            aria-label="Header name"
          />
          <input
            type="text"
            placeholder="Value"
            value={row.value}
            onChange={(e) => update(row.id, "value", e.target.value)}
            className="input-base"
            aria-label="Header value"
          />
          <button
            type="button"
            onClick={() => remove(row.id)}
            className="icon-btn shrink-0"
            aria-label="Remove header"
            title="Remove header"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="btn-secondary self-start text-xs">
        <Plus size={14} />
        Add header
      </button>
    </div>
  );
}
