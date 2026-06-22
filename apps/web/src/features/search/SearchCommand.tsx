import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { useAppStore } from '../../app/app-store';
import { searchEntries, syntheticSearchEntries, type SearchEntry } from './search-index';

function optionId(index: number): string {
  return `search-option-${index}`;
}

export function SearchCommand() {
  const { dispatch } = useAppStore();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isComposingRef = useRef(false);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const results = useMemo(() => searchEntries(syntheticSearchEntries, query), [query]);
  const [activeIndex, setActiveIndex] = useState(0);
  const isOpen = isFocused && results.length > 0;
  const activeResult = results[Math.min(activeIndex, Math.max(0, results.length - 1))];

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const selectEntry = (entry: SearchEntry) => {
    dispatch({ type: 'set-view', view: entry.targetView });
    dispatch({ type: 'set-selection', selection: entry.selection });
    setQuery(entry.primaryName);
    setIsFocused(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (isComposingRef.current) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' && activeResult !== undefined) {
      event.preventDefault();
      selectEntry(activeResult);
      return;
    }

    if (event.key === 'Escape') {
      setIsFocused(false);
    }
  };

  return (
    <div className="search-command">
      <label className="search-label" htmlFor="railway-search">
        Search
      </label>
      <input
        ref={inputRef}
        id="railway-search"
        className="search-input"
        type="search"
        value={query}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls="railway-search-results"
        aria-activedescendant={isOpen ? optionId(activeIndex) : undefined}
        autoComplete="off"
        placeholder="Station, line, or SYN-A"
        data-testid="search-input"
        onChange={(event) => {
          setQuery(event.currentTarget.value);
        }}
        onFocus={() => {
          setIsFocused(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setIsFocused(false), 100);
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen ? (
        <ul id="railway-search-results" className="search-results" role="listbox">
          {results.map((entry, index) => (
            <li
              key={entry.id}
              id={optionId(index)}
              className="search-result"
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                className="search-result-button"
                data-testid={`search-result-${entry.id}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => selectEntry(entry)}
              >
                <span className="search-result-name">{entry.primaryName}</span>
                <span className="search-result-subtitle">{entry.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
