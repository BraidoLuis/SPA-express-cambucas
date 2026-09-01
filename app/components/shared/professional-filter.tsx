"use client";

import { ListFilter, RotateCcw } from "lucide-react";

export type ProfessionalFilterOption = { id: string; name: string };

export function ProfessionalFilter({
  options,
  value,
  onChange,
  className = "",
}: {
  options: ProfessionalFilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`professional-filter ${className}`.trim()}>
      <label>
        <ListFilter aria-hidden="true" />
        <span>Profissional</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="all">Todas as profissionais</option>
          {options.map((option) => (
            <option value={option.id} key={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>

      {value !== "all" && (
        <button
          type="button"
          className="filter-reset button-with-icon"
          onClick={() => onChange("all")}
        >
          <RotateCcw aria-hidden="true" /> Limpar filtro
        </button>
      )}
    </div>
  );
}