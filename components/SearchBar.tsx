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
    <form onSubmit={submit} role="search" className="relative flex min-w-0 flex-1 items-center gap-2 rounded-full bg-cream px-3 py-2 shadow-sm ring-1 ring-plum/10 focus-within:ring-2 focus-within:ring-plum/50">
      <SearchIcon width={18} height={18} className="shrink-0 text-plum" />
      <input ref={input} value={value} onChange={(e) => change(e.target.value)} placeholder="City, address or property name" aria-label="Search properties or places" className="min-w-0 flex-1 bg-transparent py-1 text-[13px] font-semibold text-plum outline-none placeholder:font-medium placeholder:text-plum-soft" />
      {value && <button type="button" onClick={() => { change(""); input.current?.focus(); }} aria-label="Clear search" className="rounded-full p-2 text-plum-soft hover:bg-plum/5"><CloseIcon width={14} height={14} /></button>}
      <button type="submit" disabled={!value.trim() || status === "searching"} aria-label={resultCount ? "Show matching properties on map" : "Search for a place on map"} className="rounded-full bg-plum px-3 py-2 text-[11px] font-bold text-cream disabled:opacity-50">{status === "searching" ? "Finding…" : "Search"}</button>
      {value.trim() && resultCount === 0 && status !== "idle" && status !== "searching" && <p role="status" className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl bg-cream p-3 text-xs text-plum shadow-lg">{status === "found" ? "Place found on the map. No listings match this search and your filters." : status === "notfound" ? "No place found. Try a city or a more specific address." : "Place search is unavailable. Please try again."}</p>}
    </form>
  );
}
