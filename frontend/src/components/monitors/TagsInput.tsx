import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

const MAX_TAGS = 5;

/** A chip-style tag editor: type and press Enter/comma to commit a tag,
 * Backspace on an empty draft removes the last one. Deliberately not a
 * plain comma-separated text field (unlike expected_status_codes) --
 * tags are edited more often and chips make the current set legible at a
 * glance, worth the extra bit of interaction for this one field. */
export function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const value = draft.trim();
    setDraft("");
    if (!value || tags.length >= MAX_TAGS) return;
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    onChange([...tags, value]);
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && !draft && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="input-base flex flex-wrap items-center gap-1.5 py-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-accent-dim px-2 py-0.5 text-xs font-medium text-accent"
        >
          {tag}
          <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`} className="hover:opacity-70">
            <X size={12} />
          </button>
        </span>
      ))}
      {tags.length < MAX_TAGS && (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={tags.length === 0 ? "Add a tag…" : ""}
          className="min-w-24 flex-1 border-none bg-transparent p-0 text-sm text-text outline-none placeholder:text-muted"
        />
      )}
    </div>
  );
}
