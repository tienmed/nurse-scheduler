"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";

interface MultiSelectOption {
  value: string;
  label: string;
  meta?: string;
}

interface MultiSelectComboboxProps {
  name: string;
  label: string;
  options: MultiSelectOption[];
  selectedValues?: string[];
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
}

export function MultiSelectCombobox({
  name,
  label,
  options,
  selectedValues,
  placeholder = "Chọn một hoặc nhiều mục",
  disabled = false,
  emptyText = "Không có dữ liệu phù hợp.",
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(selectedValues ?? []);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Đồng bộ khi selectedValues thay đổi từ bên ngoài (nút "Gọi lại")
  useEffect(() => {
    if (selectedValues) {
      setSelected(selectedValues);
    }
  }, [selectedValues]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handlePointerDown);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const content = `${option.label} ${option.meta ?? ""}`.toLowerCase();
      return content.includes(normalizedQuery);
    });
  }, [options, query]);

  const selectedOptions = options.filter((option) => selected.includes(option.value));

  function toggleValue(value: string) {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  return (
    <div className="space-y-2 text-sm text-slate-700" ref={containerRef}>
      <span className="font-medium">{label}</span>
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className={clsx(
            "flex min-h-[56px] w-full items-center justify-between rounded-[22px] border px-4 py-3 text-left transition",
            disabled
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : "border-slate-200 bg-white hover:border-teal-400",
            open && !disabled ? "border-teal-500 ring-2 ring-teal-100" : "",
          )}
        >
          <div className="min-w-0 pr-4">
            {selectedOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedOptions.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800"
                  >
                    {option.label}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>{selectedOptions.length} đã chọn</span>
            <ChevronDown className={clsx("h-4 w-4 transition", open ? "rotate-180" : "")} />
          </div>
        </button>

        {open && !disabled ? (
          <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm vị trí việc làm"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const checked = selected.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleValue(option.value)}
                      className={clsx(
                        "flex w-full items-start justify-between rounded-2xl border px-4 py-3 text-left transition",
                        checked
                          ? "border-teal-300 bg-teal-50 text-slate-900"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <div>
                        <p className="font-medium">{option.label}</p>
                        {option.meta ? <p className="mt-1 text-xs text-slate-500">{option.meta}</p> : null}
                      </div>
                      <span
                        className={clsx(
                          "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border",
                          checked
                            ? "border-teal-500 bg-teal-500 text-white"
                            : "border-slate-300 bg-white text-transparent",
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  {emptyText}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}