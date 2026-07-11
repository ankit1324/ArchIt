"use client";

import { useState } from "react";
import { CloseIcon, SearchIcon } from "./icons";

type SearchStatus = "idle" | "searching" | "notfound";

interface SearchBarProps {
  onSearch?: (query: string) => Promise<boolean>;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [value, setValue] = useState("Chandigarh");
  const [status, setStatus] = useState<SearchStatus>("idle");

  const submit = async () => {
    const query = value.trim();
    if (!query || !onSearch || status === "searching") return;
    setStatus("searching");
    const found = await onSearch(query);
    setStatus(found ? "idle" : "notfound");
  };

  return (
    <div className="glass flex w-[300px] items-center gap-2.5 rounded-full py-2.5 pl-4 pr-3">
      <SearchIcon width={17} height={17} className="shrink-0 text-plum" />
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[13.5px]">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Search city"
          className="min-w-0 flex-1 bg-transparent font-bold text-plum outline-none placeholder:text-plum-soft/60"
          aria-label="Search location"
        />
        {status === "searching" && (
          <span className="shrink-0 animate-pulse font-medium text-plum-soft/70">
            Searching…
          </span>
        )}
        {status === "notfound" && (
          <span className="shrink-0 font-medium text-coral">No results</span>
        )}
        {status === "idle" && value === "Chandigarh" && (
          <span className="truncate font-medium text-plum-soft/70">India</span>
        )}
      </div>
      <button
        onClick={() => {
          setValue("");
          setStatus("idle");
        }}
        aria-label="Clear search"
        className="shrink-0 rounded-full p-1 text-plum-soft transition-colors hover:bg-plum/5 hover:text-plum"
      >
        <CloseIcon width={14} height={14} />
      </button>
    </div>
  );
}
