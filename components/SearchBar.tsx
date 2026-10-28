"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "./icons";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string, signal: AbortSignal) => Promise<boolean>;
  onShowResults: () => void;
  resultCount: number;
}

export default function SearchBar({ value, onChange, onSearch, onShowResults, resultCount }: SearchBarProps) {
  const [status, setStatus] = useState<"idle" | "searching" | "notfound" | "found" | "error">("idle");
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => request.current?.abort(), [value]);

  const change = (next: string) => {
    request.current?.abort();
    setStatus("idle");
    onChange(next);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    if (resultCount) { onShowResults(); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus("searching");
    try {
      const found = await onSearch(value.trim(), controller.signal);
      if (!controller.signal.aborted) setStatus(found ? "found" : "notfound");
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    }
  };

  return (
    <form onSubmit={submit} role="search" className="relative flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-paper/95 py-1 pr-1 pl-4 text-ink shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)] transition-colors focus-within:border-ink has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent">
      <SearchIcon width={18} height={18} className="shrink-0 text-ink-soft" aria-hidden="true" />
      <input ref={input} value={value} onChange={(e) => change(e.target.value)} placeholder="City, address or property name" aria-label="Search properties or places" className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] font-medium text-ink outline-none placeholder:text-ink-soft focus-visible:outline-none" />
      {value && <button type="button" onClick={() => { change(""); input.current?.focus(); }} aria-label="Clear search" className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-paper-soft hover:text-ink"><CloseIcon width={14} height={14} /></button>}
      <button type="submit" disabled={!value.trim() || status === "searching"} aria-label={resultCount ? "Show matching properties on map" : "Search for a place on map"} className="min-h-9 shrink-0 rounded-full bg-ink px-4 text-[13px] font-semibold text-paper transition-colors hover:bg-forest disabled:opacity-45">{status === "searching" ? "Finding…" : "Search"}</button>
      {value.trim() && resultCount === 0 && status !== "idle" && status !== "searching" && <p role="status" className={`absolute inset-x-0 top-full z-30 mt-2 rounded-md border border-line bg-paper px-4 py-3 text-[14px] leading-relaxed shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)] ${status === "error" ? "text-accent" : "text-ink"}`}>{status === "found" ? "Place found on the map. No listings match this search and your filters." : status === "notfound" ? "No place found. Try a city or a more specific address." : "Place search is unavailable. Please try again."}</p>}
    </form>
  );
}
