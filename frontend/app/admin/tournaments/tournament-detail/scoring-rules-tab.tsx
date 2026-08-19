"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  FileText,
  Filter,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { TournamentRow } from "../types";
import { AdminSelect } from "../../shared/admin-select";
import { apiRequest } from "../../../api";

type ScoringRule = {
  id: string;
  category: string;
  name: string;
  description: string;
  points: number;
};

type RuleDraft = Pick<ScoringRule, "category" | "name" | "description"> & {
  points: string;
};

const defaultRules: ScoringRule[] = [
  {
    id: "correct-match-winner",
    category: "PREDICTION",
    name: "Correct Match Winner",
    description: "User correctly predicts which team wins the match.",
    points: 3,
  },
  {
    id: "exact-scoreline",
    category: "PREDICTION",
    name: "Exact Scoreline",
    description: "User predicts the exact final match or round score.",
    points: 5,
  },
  {
    id: "first-blood",
    category: "IN-GAME EVENT",
    name: "First Blood Prediction",
    description: "User predicts which player secures the first elimination.",
    points: 2,
  },
];

export function ScoringRulesView({
  tournament,
  canManage,
}: {
  tournament: TournamentRow;
  canManage: boolean;
}) {
  const [rules, setRules] = useState(defaultRules);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [saved, setSaved] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>({
    category: "",
    name: "",
    description: "",
    points: "0",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;

    apiRequest<
      Array<{
        id: number;
        category: string;
        title: string;
        content: string;
        points: number;
      }>
    >(`/scoring-rules?tournamentId=${tournament.id}`)
      .then((data) => {
        if (!isMounted) return;

        setRules(
          data.map((rule) => ({
            id: String(rule.id),
            category: rule.category,
            name: rule.title,
            description: rule.content,
            points: rule.points,
          })),
        );
        setSaved(true);
        setImportMessage("");
      })
      .catch((error) => {
        if (isMounted) {
          setImportMessage(
            error instanceof Error
              ? error.message
              : "Unable to load scoring rules.",
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [tournament.id]);

  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(rules.map((rule) => rule.category)))],
    [rules],
  );
  const visibleRules = rules.filter((rule) => {
    const matchesQuery = `${rule.name} ${rule.description} ${rule.category}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesQuery && (category === "ALL" || rule.category === category);
  });

  function addRule() {
    if (!canManage) return;

    const id = `custom-${Date.now()}`;
    const newRule = {
      id,
      category: "CUSTOM",
      name: "New Scoring Rule",
      description: "Describe when users receive these points.",
      points: 1,
    };
    setRules((current) => [...current, newRule]);
    setEditingId(id);
    setRuleDraft({
      category: newRule.category,
      name: newRule.name,
      description: newRule.description,
      points: String(newRule.points),
    });
    setSaved(false);
  }

  function removeRule(id: string) {
    if (!canManage) return;

    setRules((current) => current.filter((rule) => rule.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
    setSaved(false);
  }

  function updateRuleDraft(field: keyof RuleDraft, value: string) {
    setRuleDraft((current) => ({
      ...current,
      [field]:
        field === "category"
          ? value.toUpperCase()
          : field === "points"
            ? normalizePointInput(value)
            : value,
    }));
  }

  function normalizePointInput(value: string) {
    const digits = value.replace(/\D/g, "");
    return digits.replace(/^0+(?=\d)/, "") || "0";
  }

  function startEditing(rule: ScoringRule) {
    if (!canManage) return;

    setEditingId(rule.id);
    setRuleDraft({
      category: rule.category,
      name: rule.name,
      description: rule.description,
      points: String(rule.points),
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setRuleDraft({
      category: "",
      name: "",
      description: "",
      points: "0",
    });
  }

  function saveRuleDetails(id: string) {
    if (!canManage) return;

    setRules((current) =>
      current.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              category: ruleDraft.category.trim() || "CUSTOM",
              name: ruleDraft.name.trim() || "Untitled Rule",
              description:
                ruleDraft.description.trim() ||
                "Describe when users receive these points.",
              points: Math.max(0, Number.parseInt(ruleDraft.points || "0", 10)),
            }
          : rule,
      ),
    );
    cancelEditing();
    setSaved(false);
  }

  async function importRules(event: ChangeEvent<HTMLInputElement>) {
    if (!canManage) return;

    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (!isWordFile(file)) {
        setImportMessage("Only Word files are allowed for scoring rules.");
        return;
      }

      if (file.name.toLowerCase().endsWith(".doc")) {
        setImportMessage("Please convert .doc files to .docx before import.");
        return;
      }

      const text = await extractDocxText(file);
      const normalized = buildRulesFromWordText(text);

      if (normalized.length === 0) {
        setImportMessage("No scoring rules found in this Word file.");
        return;
      }

      setRules(normalized);
      setImportMessage(`${normalized.length} rules imported from ${file.name}`);
      setSaved(false);
    } catch {
      setImportMessage("Unable to import. Use a valid .docx Word file.");
    } finally {
      event.target.value = "";
    }
  }

  async function saveRules() {
    if (!canManage) return;

    setIsSaving(true);

    try {
      const savedRules = await apiRequest<
        Array<{
          id: number;
          category: string;
          title: string;
          content: string;
          points: number;
        }>
      >(`/scoring-rules?tournamentId=${tournament.id}`, {
        method: "PUT",
        body: JSON.stringify({
          rules: rules.map((rule, index) => ({
            category: rule.category,
            title: rule.name,
            content: rule.description,
            points: rule.points,
            sortOrder: index + 1,
          })),
        }),
      });

      setRules(
        savedRules.map((rule) => ({
          id: String(rule.id),
          category: rule.category,
          name: rule.title,
          description: rule.content,
          points: rule.points,
        })),
      );
      setSaved(true);
      setImportMessage("Scoring rules saved.");
    } catch (error) {
      setImportMessage(
        error instanceof Error
          ? error.message
          : "Unable to save scoring rules.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="border-t border-[#314850] bg-[#07181d] p-4 sm:p-7 lg:p-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#84d8e8]">
            Tournaments <span className="px-2 text-[#607b83]">&gt;</span>{" "}
            {tournament.name} <span className="px-2 text-[#607b83]">&gt;</span>{" "}
            Scoring Rules
          </p>
          <h4 className="mt-3 text-3xl font-black text-white">
            Scoring Configuration
          </h4>
          <p className="mt-2 text-sm text-[#9fb2b8]">
            Manage points distribution and prediction rules for this tournament.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                setImportMessage(
                  "Version history will be connected to the API next.",
                )
              }
              className="inline-flex items-center gap-2 border border-[#3a4d54] bg-[#0d252d] px-4 py-3 text-[11px] font-black uppercase tracking-[0.1em] text-[#dce8eb] hover:border-[#84d8e8]"
            >
              <History size={15} /> Version History
            </button>
            <button
              type="button"
              onClick={() => void saveRules()}
              disabled={isSaving || isLoading}
              className="inline-flex items-center gap-2 border border-[#84d8e8] bg-[#84d8e8] px-4 py-3 text-[11px] font-black uppercase tracking-[0.1em] text-[#06161b] hover:bg-[#a5e5f0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check size={15} />{" "}
              {isSaving ? "Saving..." : saved ? "Saved" : "Save Changes"}
            </button>
          </div>
        ) : (
          <span className="border border-[#3a4d54] bg-[#0d252d] px-4 py-3 text-[11px] font-black uppercase tracking-[0.1em] text-[#789098]">
            View Only
          </span>
        )}
      </div>

      <div
        className={`grid gap-5 ${canManage ? "lg:grid-cols-[270px_minmax(0,1fr)]" : ""}`}
      >
        {canManage && (
          <section className="border border-[#3a4d54] bg-[#0d252d] p-4">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#dce8eb]">
              <Upload size={15} /> Import Rules
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 flex min-h-44 w-full flex-col items-center justify-center border border-dashed border-[#3a4d54] bg-[#07181d] px-4 text-center hover:border-[#84d8e8]"
            >
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-lg bg-[#203841] text-[#84d8e8]">
                <FileText size={21} />
              </span>
              <span className="text-sm font-black text-[#dce8eb]">
                Choose Word Rules File
              </span>
              <span className="mt-2 text-xs text-[#789098]">
                Supports .docx Word documents only
              </span>
              <span className="mt-4 border border-[#3a4d54] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#84d8e8]">
                Browse Files
              </span>
            </button>
            <input
              ref={fileInputRef}
              onChange={importRules}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
            />
            <div className="mt-4 border border-[#243c43] bg-[#10242b] px-3 py-3 text-xs text-[#9fb2b8]">
              <span className="font-black text-[#dce8eb]">Last imported:</span>{" "}
              {importMessage || "No file imported yet"}
            </div>
          </section>
        )}

        <section className="border border-[#3a4d54] bg-[#0d252d] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3a4d54] pb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#dce8eb]">
              Active Ruleset
            </p>
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] gap-2 sm:flex sm:w-auto">
              <label className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-3 text-[#84d8e8]"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter rules..."
                  className="h-9 w-full border border-[#3a4d54] bg-[#07181d] pl-9 pr-3 text-xs font-bold text-white outline-none placeholder:text-[#789098] focus:border-[#84d8e8] sm:w-48"
                />
              </label>
              <AdminSelect
                value={category}
                onChange={setCategory}
                options={categories.map((item) => ({
                  label: item,
                  value: item,
                }))}
                ariaLabel="Filter rule category"
                className="h-9 min-w-[118px]"
              />
              {canManage && (
                <button
                  type="button"
                  onClick={addRule}
                  aria-label="Add scoring rule"
                  title="Add scoring rule"
                  className="grid h-9 w-9 place-items-center border border-[#3a4d54] text-[#84d8e8] hover:border-[#84d8e8]"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {isLoading && (
              <p className="border border-dashed border-[#3a4d54] px-6 py-14 text-center text-sm text-[#9fb2b8]">
                Loading scoring rules...
              </p>
            )}
            {!isLoading &&
              visibleRules.map((rule) => {
                const isEditing = canManage && editingId === rule.id;

                return (
                  <article
                    key={rule.id}
                    className="border border-[#243c43] bg-[#07181d] transition hover:border-[#4e6972] hover:bg-[#0a1f25]"
                  >
                    <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_112px] sm:p-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-7 items-center rounded border border-[#31545e] bg-[#102b33] px-2 text-[9px] font-black uppercase tracking-[0.1em] text-[#84d8e8]">
                            {rule.category}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#607b83]">
                            <Filter size={12} /> Rule
                          </span>
                        </div>

                        {isEditing ? (
                          <div className="mt-4 grid gap-3">
                            <label className="grid gap-1">
                              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#84d8e8]">
                                Category
                              </span>
                              <input
                                value={ruleDraft.category}
                                onChange={(event) =>
                                  updateRuleDraft(
                                    "category",
                                    event.target.value,
                                  )
                                }
                                aria-label="Rule category"
                                className="h-10 w-full border border-[#3a4d54] bg-[#0d252d] px-3 text-xs font-black uppercase text-[#84d8e8] outline-none focus:border-[#84d8e8]"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#84d8e8]">
                                Title
                              </span>
                              <input
                                value={ruleDraft.name}
                                onChange={(event) =>
                                  updateRuleDraft("name", event.target.value)
                                }
                                aria-label="Rule title"
                                className="h-11 w-full border border-[#3a4d54] bg-[#0d252d] px-3 text-sm font-black text-white outline-none focus:border-[#84d8e8]"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#84d8e8]">
                                Content
                              </span>
                              <textarea
                                value={ruleDraft.description}
                                onChange={(event) =>
                                  updateRuleDraft(
                                    "description",
                                    event.target.value,
                                  )
                                }
                                aria-label="Rule content"
                                rows={3}
                                className="w-full resize-none border border-[#3a4d54] bg-[#0d252d] px-3 py-3 text-sm leading-5 text-[#dce8eb] outline-none focus:border-[#84d8e8]"
                              />
                            </label>
                          </div>
                        ) : (
                          <>
                            <h5 className="mt-3 text-lg font-black leading-6 text-white">
                              {rule.name}
                            </h5>
                            <p className="mt-2 max-w-3xl text-sm leading-5 text-[#9fb2b8]">
                              {rule.description}
                            </p>
                          </>
                        )}
                      </div>

                      <label className="grid content-start gap-2 rounded border border-[#243c43] bg-[#06161b] p-3">
                        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#789098]">
                          Point
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          readOnly={!isEditing}
                          value={
                            isEditing ? ruleDraft.points : String(rule.points)
                          }
                          onChange={(event) =>
                            updateRuleDraft("points", event.target.value)
                          }
                          className="points-input h-12 w-full border border-[#31545e] bg-[#0d252d] text-center text-3xl font-black text-white outline-none focus:border-[#84d8e8] read-only:cursor-default read-only:border-[#243c43]"
                        />
                      </label>
                    </div>

                    {canManage && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#243c43] px-4 py-3 sm:px-5">
                        <p className="text-[11px] font-bold text-[#789098]">
                          {isEditing
                            ? "Editing title and content"
                            : "Ready to edit"}
                        </p>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => saveRuleDetails(rule.id)}
                                className="inline-flex h-9 items-center gap-2 border border-[#84d8e8] bg-[#84d8e8] px-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#06161b] hover:bg-[#a5e5f0]"
                              >
                                <Check size={14} /> Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                className="inline-flex h-9 items-center gap-2 border border-[#3a4d54] px-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#dce8eb] hover:border-[#84d8e8] hover:text-[#84d8e8]"
                              >
                                <X size={14} /> Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditing(rule)}
                              aria-label={`Edit ${rule.name}`}
                              className="inline-flex h-9 items-center gap-2 border border-[#3a4d54] px-3 text-[11px] font-black uppercase tracking-[0.08em] text-[#84d8e8] hover:border-[#84d8e8] hover:bg-[#102b33]"
                            >
                              <Pencil size={14} /> Edit
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeRule(rule.id)}
                            aria-label={`Remove ${rule.name}`}
                            title="Delete rule"
                            className="grid h-9 w-9 place-items-center border border-[#3a4d54] text-[#789098] hover:border-[#ff8f8f] hover:bg-[#302327] hover:text-[#ff8f8f]"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            {visibleRules.length === 0 && (
              <p className="border border-dashed border-[#3a4d54] px-6 py-14 text-center text-sm text-[#9fb2b8]">
                No scoring rules match your filter.
              </p>
            )}
          </div>
          {importMessage && (
            <p className="mt-4 text-xs font-bold text-[#84d8e8]">
              {importMessage}{" "}
              <button
                type="button"
                onClick={() => setImportMessage("")}
                aria-label="Dismiss message"
              >
                <X size={13} className="inline" />
              </button>
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

function isWordFile(file: File) {
  const fileName = file.name.toLowerCase();

  return (
    fileName.endsWith(".docx") ||
    fileName.endsWith(".doc") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "application/msword"
  );
}

async function extractDocxText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const xmlBytes = await readDocxEntry(bytes, "word/document.xml");
  const xml = new TextDecoder().decode(xmlBytes);
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];
  const lines = paragraphs
    .map((paragraph) =>
      Array.from(paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g))
        .map((match) => decodeXmlEntities(match[1] ?? ""))
        .join(""),
    )
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.join("\n");
}

async function readDocxEntry(bytes: Uint8Array, targetName: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findZipEndOffset(view);
  const totalEntries = view.getUint16(endOffset + 10, true);
  let centralOffset = view.getUint32(endOffset + 16, true);

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) {
      break;
    }

    const method = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const fileNameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localHeaderOffset = view.getUint32(centralOffset + 42, true);
    const fileName = new TextDecoder().decode(
      bytes.slice(centralOffset + 46, centralOffset + 46 + fileNameLength),
    );

    if (fileName === targetName) {
      const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart =
        localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);

      if (method === 0) {
        return compressed;
      }

      if (method === 8) {
        return decompressDeflateRaw(compressed);
      }

      throw new Error("Unsupported Word compression.");
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error("Word document content was not found.");
}

function findZipEndOffset(view: DataView) {
  const minimumEndSize = 22;
  const maxCommentSize = 0xffff;
  const minOffset = Math.max(
    0,
    view.byteLength - minimumEndSize - maxCommentSize,
  );

  for (
    let offset = view.byteLength - minimumEndSize;
    offset >= minOffset;
    offset -= 1
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("Invalid Word file.");
}

async function decompressDeflateRaw(bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([buffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const decompressedBuffer = await new Response(stream).arrayBuffer();

  return new Uint8Array(decompressedBuffer);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function buildRulesFromWordText(text: string): ScoringRule[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const { content, points } = extractRulePoints(line);
      const parts = content
        .split(/\s+\|\s+|\s+[–—-]\s+|:\s+/)
        .map((part) => part.trim())
        .filter(Boolean);

      return {
        id: `word-${Date.now()}-${index}`,
        category: "CUSTOM",
        name: parts[0] || `Imported Rule ${index + 1}`,
        description: parts.slice(1).join(" - ") || content,
        points,
      };
    });
}

function extractRulePoints(line: string) {
  const match = line.match(/(?:^|\s)(\d+)\s*(?:pts?|points?|diem|điểm)?\s*$/i);

  if (!match || match.index === undefined) {
    return { content: line, points: 0 };
  }

  return {
    content: line
      .slice(0, match.index)
      .replace(/[|,;:–—-]+$/g, "")
      .trim(),
    points: Math.max(0, Number(match[1])),
  };
}
