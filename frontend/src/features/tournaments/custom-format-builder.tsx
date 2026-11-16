"use client";

import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import {
  CalendarRange,
  GitBranch,
  GripVertical,
  Layers3,
  Plus,
  RotateCcw,
  Save,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type {
  CustomStageType,
  CustomTournamentFormat,
  CustomTournamentStage,
} from "./types";

type StageTemplate = {
  type: CustomStageType;
  label: string;
  description: string;
  teamsIn: number;
  teamsAdvance: number;
  matchFormat: CustomTournamentStage["matchFormat"];
  icon: typeof Users;
};

const stageTemplates: StageTemplate[] = [
  {
    type: "GROUP_STAGE",
    label: "Group Stage",
    description: "Split teams into groups before knockout rounds.",
    teamsIn: 16,
    teamsAdvance: 8,
    matchFormat: "BO1",
    icon: Users,
  },
  {
    type: "ROUND_ROBIN",
    label: "Round Robin",
    description: "Every team plays every other team.",
    teamsIn: 10,
    teamsAdvance: 6,
    matchFormat: "BO1",
    icon: RotateCcw,
  },
  {
    type: "QUARTERFINAL",
    label: "Quarterfinal",
    description: "Eight teams compete for semi-final slots.",
    teamsIn: 8,
    teamsAdvance: 4,
    matchFormat: "BO5",
    icon: GitBranch,
  },
  {
    type: "SEMIFINAL",
    label: "Semifinal",
    description: "Four teams compete for final slots.",
    teamsIn: 4,
    teamsAdvance: 2,
    matchFormat: "BO5",
    icon: GitBranch,
  },
  {
    type: "FINAL",
    label: "Final",
    description: "Final match to determine the champion.",
    teamsIn: 2,
    teamsAdvance: 1,
    matchFormat: "BO5",
    icon: Trophy,
  },
  {
    type: "PLAYOFFS",
    label: "Playoffs",
    description: "Flexible knockout bracket stage.",
    teamsIn: 6,
    teamsAdvance: 2,
    matchFormat: "BO5",
    icon: CalendarRange,
  },
  {
    type: "SWISS_STAGE",
    label: "Swiss Stage",
    description: "Pair teams by record across rounds.",
    teamsIn: 16,
    teamsAdvance: 8,
    matchFormat: "BO3",
    icon: Layers3,
  },
];

const defaultTieBreakers = ["Match Wins", "Game Win Rate", "Head-to-Head"];

function createStage(template: StageTemplate): CustomTournamentStage {
  return {
    id: `${template.type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: template.type,
    label: template.label,
    teamsIn: template.teamsIn,
    teamsAdvance: template.teamsAdvance,
    matchFormat: template.matchFormat,
    tieBreakers: defaultTieBreakers,
    predictionLockHours: 24,
  };
}

function createDefaultFormat(): CustomTournamentFormat {
  const stages = ["GROUP_STAGE", "QUARTERFINAL", "SEMIFINAL", "FINAL"]
    .map((type) => stageTemplates.find((template) => template.type === type))
    .filter(Boolean)
    .map((template) => createStage(template as StageTemplate));

  return {
    name: "Custom Tournament Format",
    stages,
  };
}

export function CustomFormatBuilderModal({
  initialFormat,
  tournamentName,
  onCancel,
  onSave,
}: {
  initialFormat: CustomTournamentFormat | null;
  tournamentName: string;
  onCancel: () => void;
  onSave: (format: CustomTournamentFormat) => void;
}) {
  const [draft, setDraft] = useState<CustomTournamentFormat>(
    initialFormat?.stages.length ? initialFormat : createDefaultFormat(),
  );
  const [selectedStageId, setSelectedStageId] = useState(
    draft.stages[0]?.id ?? "",
  );
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);

  const selectedStage = useMemo(
    () => draft.stages.find((stage) => stage.id === selectedStageId) ?? null,
    [draft.stages, selectedStageId],
  );

  function addStage(type: CustomStageType, insertIndex = draft.stages.length) {
    const template = stageTemplates.find((item) => item.type === type);

    if (!template) {
      return;
    }

    const stage = createStage(template);
    const nextStages = [...draft.stages];
    nextStages.splice(insertIndex, 0, stage);
    setDraft((current) => ({ ...current, stages: nextStages }));
    setSelectedStageId(stage.id);
  }

  function moveStage(fromId: string, toIndex: number) {
    setDraft((current) => {
      const currentIndex = current.stages.findIndex(
        (stage) => stage.id === fromId,
      );

      if (currentIndex < 0) {
        return current;
      }

      const nextStages = [...current.stages];
      const [stage] = nextStages.splice(currentIndex, 1);
      nextStages.splice(toIndex, 0, stage);

      return { ...current, stages: nextStages };
    });
  }

  function updateSelectedStage(
    updates: Partial<Omit<CustomTournamentStage, "id" | "type">>,
  ) {
    if (!selectedStage) {
      return;
    }

    setDraft((current) => ({
      ...current,
      stages: current.stages.map((stage) =>
        stage.id === selectedStage.id ? { ...stage, ...updates } : stage,
      ),
    }));
  }

  function removeSelectedStage() {
    if (!selectedStage) {
      return;
    }

    setDraft((current) => {
      const nextStages = current.stages.filter(
        (stage) => stage.id !== selectedStage.id,
      );

      setSelectedStageId(nextStages[0]?.id ?? "");

      return { ...current, stages: nextStages };
    });
  }

  function handlePaletteDragStart(
    event: DragEvent<HTMLDivElement>,
    type: CustomStageType,
  ) {
    event.dataTransfer.setData("application/x-stage-template", type);
    event.dataTransfer.effectAllowed = "copy";
  }

  function handleCanvasDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const type = event.dataTransfer.getData(
      "application/x-stage-template",
    ) as CustomStageType;

    if (type) {
      addStage(type);
      return;
    }

    if (draggedStageId) {
      moveStage(draggedStageId, draft.stages.length - 1);
      setDraggedStageId(null);
    }
  }

  function handleStageDrop(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    const type = event.dataTransfer.getData(
      "application/x-stage-template",
    ) as CustomStageType;

    if (type) {
      addStage(type, index);
      return;
    }

    if (draggedStageId) {
      moveStage(draggedStageId, index);
      setDraggedStageId(null);
    }
  }

  function saveFormat() {
    const normalizedStages = draft.stages.map((stage) => ({
      ...stage,
      teamsIn: Math.max(1, Number(stage.teamsIn) || 1),
      teamsAdvance: Math.max(0, Number(stage.teamsAdvance) || 0),
      predictionLockHours: Math.max(
        0,
        Number(stage.predictionLockHours) || 0,
      ),
    }));

    onSave({
      name: draft.name.trim() || "Custom Tournament Format",
      stages: normalizedStages,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4 py-6">
      <div className="flex max-h-[92vh] w-full max-w-[1320px] flex-col overflow-hidden rounded border border-[#244850] bg-[#06181d] shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#244850] px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#84d8e8]">
              {tournamentName || "New Tournament"}
            </p>
            <h3 className="mt-1 text-2xl font-black text-white">
              Tournament Format Builder
            </h3>
            <p className="mt-2 text-sm font-bold text-[#9fb2b8]">
              Drag stages from the palette into the format canvas.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 items-center gap-2 rounded border border-white/10 px-4 text-sm font-black text-zinc-200 transition hover:border-[#84d8e8]/60"
            >
              <X size={17} />
              Close
            </button>
            <button
              type="button"
              onClick={saveFormat}
              className="inline-flex h-11 items-center gap-2 rounded bg-[#84d8e8] px-5 text-sm font-black text-[#06161b] transition hover:bg-[#9eeeff]"
            >
              <Save size={17} />
              Save Custom Format
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <section className="rounded border border-[#244850] bg-[#0b252c] p-4">
            <h4 className="text-lg font-black text-white">Stage Palette</h4>
            <p className="mt-2 text-sm font-bold text-[#9fb2b8]">
              Drag a card or click plus to add it.
            </p>
            <div className="mt-4 space-y-3">
              {stageTemplates.map((template) => {
                const Icon = template.icon;

                return (
                  <div
                    key={template.type}
                    draggable
                    onDragStart={(event) =>
                      handlePaletteDragStart(event, template.type)
                    }
                    className="group rounded border border-[#2d4b54] bg-[#0d2a32] p-3 transition hover:border-[#84d8e8]"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="text-[#84d8e8]" size={20} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-white">
                          {template.label}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs font-bold text-[#9fb2b8]">
                          {template.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addStage(template.type)}
                        className="grid h-8 w-8 place-items-center rounded border border-[#244850] text-[#84d8e8] transition hover:bg-[#123740]"
                        aria-label={`Add ${template.label}`}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
            className="rounded border border-[#244850] bg-[#071b20] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-black text-white">
                  Tournament Format
                </h4>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 h-10 w-[min(420px,100%)] rounded border border-[#244850] bg-[#031115] px-3 text-sm font-bold text-white outline-none focus:border-[#84d8e8]"
                  aria-label="Custom format name"
                />
              </div>
              <p className="rounded border border-[#244850] bg-[#0d2a32] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#84d8e8]">
                {draft.stages.length} stages
              </p>
            </div>

            <div className="mt-6 min-h-[440px] rounded border border-dashed border-[#244850] bg-[radial-gradient(circle_at_1px_1px,#143942_1px,transparent_0)] [background-size:18px_18px] p-6">
              {draft.stages.length === 0 ? (
                <div className="flex h-full min-h-[360px] items-center justify-center rounded border border-dashed border-[#84d8e8]/50 text-center">
                  <p className="max-w-[280px] text-sm font-bold text-[#9fb2b8]">
                    Drop your first stage here to start building a custom
                    tournament flow.
                  </p>
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-wrap items-center gap-4">
                  {draft.stages.map((stage, index) => (
                    <div
                      key={stage.id}
                      className="flex items-center gap-4"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleStageDrop(event, index)}
                    >
                      <button
                        type="button"
                        draggable
                        onDragStart={() => setDraggedStageId(stage.id)}
                        onDragEnd={() => setDraggedStageId(null)}
                        onClick={() => setSelectedStageId(stage.id)}
                        className={`w-[150px] rounded border p-4 text-left transition ${
                          stage.id === selectedStageId
                            ? "border-[#84d8e8] bg-[#123740] shadow-[0_0_20px_rgba(132,216,232,0.22)]"
                            : "border-[#2d4b54] bg-[#0d2a32] hover:border-[#84d8e8]/70"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <GripVertical
                            size={16}
                            className="text-[#9fb2b8]"
                          />
                          <span className="text-xs font-black text-[#84d8e8]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <p className="mt-4 min-h-[40px] text-sm font-black text-white">
                          {stage.label}
                        </p>
                        <p className="mt-2 text-xs font-bold text-[#9fb2b8]">
                          {stage.teamsIn} in / {stage.teamsAdvance} advance
                        </p>
                      </button>
                      {index < draft.stages.length - 1 && (
                        <span className="text-2xl font-black text-[#84d8e8]">
                          →
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded border border-[#244850] bg-[#0b252c] p-4">
            <h4 className="text-lg font-black text-white">
              Stage Configuration
            </h4>
            {selectedStage ? (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
                    Stage Title
                  </span>
                  <input
                    value={selectedStage.label}
                    onChange={(event) =>
                      updateSelectedStage({ label: event.target.value })
                    }
                    className="h-11 w-full rounded border border-[#244850] bg-[#031115] px-3 font-bold text-white outline-none focus:border-[#84d8e8]"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <StageNumberInput
                    label="Teams In"
                    value={selectedStage.teamsIn}
                    onChange={(teamsIn) => updateSelectedStage({ teamsIn })}
                  />
                  <StageNumberInput
                    label="Advance"
                    value={selectedStage.teamsAdvance}
                    onChange={(teamsAdvance) =>
                      updateSelectedStage({ teamsAdvance })
                    }
                  />
                </div>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
                    Match Format
                  </span>
                  <select
                    value={selectedStage.matchFormat}
                    onChange={(event) =>
                      updateSelectedStage({
                        matchFormat: event.target
                          .value as CustomTournamentStage["matchFormat"],
                      })
                    }
                    className="h-11 w-full rounded border border-[#244850] bg-[#031115] px-3 font-bold text-white outline-none focus:border-[#84d8e8]"
                  >
                    <option value="BO1">Best of 1</option>
                    <option value="BO3">Best of 3</option>
                    <option value="BO5">Best of 5</option>
                  </select>
                </label>
                <StageNumberInput
                  label="Prediction Lock Hours"
                  value={selectedStage.predictionLockHours}
                  onChange={(predictionLockHours) =>
                    updateSelectedStage({ predictionLockHours })
                  }
                />
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
                    Tie Breakers
                  </span>
                  <textarea
                    value={selectedStage.tieBreakers.join(", ")}
                    onChange={(event) =>
                      updateSelectedStage({
                        tieBreakers: event.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean),
                      })
                    }
                    rows={3}
                    className="w-full rounded border border-[#244850] bg-[#031115] p-3 text-sm font-bold text-white outline-none focus:border-[#84d8e8]"
                  />
                </label>
                <div className="rounded border border-[#8a650f] bg-[#3b2c08] p-3 text-xs font-bold text-[#ffd36a]">
                  Changing these settings may affect generated stages, matches
                  and predictions.
                </div>
                <button
                  type="button"
                  onClick={removeSelectedStage}
                  className="h-11 w-full rounded border border-[#ff6b6b99] text-sm font-black text-[#ff8a8a] transition hover:bg-[#3a1519]"
                >
                  Remove Stage
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded border border-dashed border-[#244850] p-5 text-sm font-bold text-[#9fb2b8]">
                Select a stage on the canvas to edit its rules.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StageNumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#9fb2b8]">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full rounded border border-[#244850] bg-[#031115] px-3 font-bold text-white outline-none focus:border-[#84d8e8]"
      />
    </label>
  );
}
