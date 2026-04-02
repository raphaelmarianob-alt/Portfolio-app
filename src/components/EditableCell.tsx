"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  value: string;
  type?: "text" | "number" | "select" | "textarea";
  options?: string[];
  onSave: (value: string) => void;
}

export function EditableCell({ value, type = "text", options, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    setEditing(false);
    if (editValue !== value) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea") {
      handleSave();
    }
    if (e.key === "Escape") {
      setEditValue(value);
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        className="cursor-pointer hover:bg-emerald-500/10 px-1 py-0.5 rounded block min-h-[20px] min-w-[30px] text-[#e4e4e7]"
        title="Clique para editar"
      >
        {value || "—"}
      </span>
    );
  }

  if (type === "select" && options) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={editValue}
        onChange={(e) => {
          setEditValue(e.target.value);
          onSave(e.target.value);
          setEditing(false);
        }}
        onBlur={handleSave}
        className="bg-[#1a1b26] border border-emerald-500/50 rounded-lg px-1 py-0.5 text-sm w-full text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (type === "textarea") {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        rows={4}
        className="bg-[#1a1b26] border border-emerald-500/50 rounded-lg px-2 py-1 text-sm w-full mt-1 text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={type === "number" ? "number" : "text"}
      step={type === "number" ? "0.01" : undefined}
      value={editValue === "—" ? "" : editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      className="bg-[#1a1b26] border border-emerald-500/50 rounded-lg px-1 py-0.5 text-sm w-full text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
    />
  );
}
