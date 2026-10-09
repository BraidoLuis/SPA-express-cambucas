"use client";

import { useId, useRef } from "react";
import { Search, X } from "lucide-react";

export function ServiceSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="service-search">
      <label htmlFor={id}>Pesquisar serviços</label>
      <div className="service-search-control">
        <Search aria-hidden="true" />
        <input
          ref={input}
          id={id}
          type="search"
          value={value}
          placeholder="Nome do serviço"
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
        />
        {value && (
          <button
            type="button"
            aria-label="Limpar pesquisa"
            onClick={() => {
              onChange("");
              input.current?.focus();
            }}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
