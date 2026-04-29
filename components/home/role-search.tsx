"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

type RoleSearchSuggestion = {
  slug: string;
  label: string;
  secondaryLabel: string;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isSubsequence(query: string, candidate: string) {
  let cursor = 0;
  for (const char of candidate) {
    if (char === query[cursor]) {
      cursor += 1;
      if (cursor === query.length) {
        return true;
      }
    }
  }

  return false;
}

function scoreSuggestion(query: string, suggestion: RoleSearchSuggestion) {
  const normalizedQuery = normalizeText(query);
  const candidateTexts = [suggestion.label, suggestion.secondaryLabel, suggestion.slug].map(normalizeText);

  if (!normalizedQuery) {
    return 1;
  }

  let bestScore = -1;
  for (const text of candidateTexts) {
    if (!text) continue;
    if (text === normalizedQuery) {
      bestScore = Math.max(bestScore, 1000);
      continue;
    }
    if (text.startsWith(normalizedQuery)) {
      bestScore = Math.max(bestScore, 900 - text.indexOf(normalizedQuery));
      continue;
    }
    if (text.includes(normalizedQuery)) {
      bestScore = Math.max(bestScore, 800 - text.indexOf(normalizedQuery));
      continue;
    }
    const queryTokens = normalizedQuery.split(" ").filter(Boolean);
    if (queryTokens.length && queryTokens.every((token) => text.includes(token))) {
      bestScore = Math.max(bestScore, 650 - text.length);
      continue;
    }
    if (isSubsequence(normalizedQuery.replace(/\s+/g, ""), text.replace(/\s+/g, ""))) {
      bestScore = Math.max(bestScore, 500 - text.length);
    }
  }

  return bestScore;
}

export function RoleSearch({
  hint,
  label,
  locale,
  placeholder,
  suggestions
}: {
  hint: string;
  label: string;
  locale: "en" | "zh";
  placeholder: string;
  suggestions: RoleSearchSuggestion[];
}) {
  const router = useRouter();
  const inputId = useId();
  const listboxId = `${inputId}-results`;
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const filteredSuggestions = [...suggestions]
    .map((suggestion) => ({
      ...suggestion,
      score: scoreSuggestion(deferredQuery, suggestion)
    }))
    .filter((suggestion) => suggestion.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.label.localeCompare(right.label);
    })
    .slice(0, deferredQuery.trim() ? 8 : 6);

  const queryTrimmed = query.trim();
  const resultsCountLabel =
    locale === "zh"
      ? queryTrimmed
        ? `${filteredSuggestions.length} 个匹配`
        : `浏览 ${filteredSuggestions.length} 个推荐`
      : queryTrimmed
        ? `${filteredSuggestions.length} matches`
        : `Browse ${filteredSuggestions.length} suggestions`;
  const statusLabel =
    locale === "zh"
      ? queryTrimmed
        ? "按回车打开首个匹配项，或使用方向键选择"
        : "输入岗位名称、别名或 slug 来缩小范围"
      : queryTrimmed
        ? "Press Enter to open the top match, or use arrow keys to move"
        : "Type a role name, alias, or slug to narrow the list";

  function navigateToRole(slug: string) {
    setIsOpen(false);
    router.push(`/${locale}/roles/${slug}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const matched = filteredSuggestions[activeIndex] ?? filteredSuggestions[0];
    if (matched) {
      navigateToRole(matched.slug);
    }
  }

  function handleBlur() {
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 120);
  }

  function handleFocus() {
    setIsOpen(true);
  }

  function handleChange(value: string) {
    setQuery(value);
    setActiveIndex(0);
    setIsOpen(true);
  }

  useEffect(() => {
    for (const suggestion of filteredSuggestions.slice(0, 6)) {
      void router.prefetch(`/${locale}/roles/${suggestion.slug}`);
    }
  }, [filteredSuggestions, locale, router]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!filteredSuggestions.length) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % filteredSuggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const matched = filteredSuggestions[activeIndex] ?? filteredSuggestions[0];
      if (matched) {
        navigateToRole(matched.slug);
      }
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  return (
    <form className="search-shell search-shell-inline" onSubmit={handleSubmit}>
      <label className="search-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="search-autocomplete">
        <div className="search-input-row">
          <input
            id={inputId}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-label={label}
            className="role-search role-search-pinterest"
            placeholder={placeholder}
            role="combobox"
            value={query}
            onBlur={handleBlur}
            onChange={(event) => handleChange(event.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
          />
          <button className="search-submit search-submit-pinterest" type="submit">
            {locale === "zh" ? "查看" : "Open"}
          </button>
        </div>
        <div className="search-status-row">
          <span className="search-hint">{resultsCountLabel}</span>
          <span className="search-hint">{statusLabel}</span>
        </div>
        {isOpen && filteredSuggestions.length ? (
          <div className="search-results search-results-board" role="listbox" id={listboxId}>
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.slug}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`search-result${index === activeIndex ? " search-result-active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  navigateToRole(suggestion.slug);
                }}
                onClick={() => navigateToRole(suggestion.slug)}
              >
                <span className="search-result-label">{suggestion.label}</span>
                {suggestion.secondaryLabel ? (
                  <span className="search-result-secondary">{suggestion.secondaryLabel}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : isOpen ? (
          <div className="search-results search-results-empty" role="status">
            <p className="search-empty-title">{locale === "zh" ? "没有匹配项" : "No matches"}</p>
            <p className="search-empty-copy">
              {locale === "zh"
                ? "换一个关键词，或试试更短的岗位名称。"
                : "Try a different keyword or a shorter role name."}
            </p>
          </div>
        ) : null}
      </div>
      <p className="search-hint">{hint}</p>
    </form>
  );
}
