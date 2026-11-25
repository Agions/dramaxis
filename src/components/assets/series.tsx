/**
 * dramaxis · assets/series.tsx · 短剧连载矩阵 (Series → Episode → Variant) 与设定集 (StoryBible)
 *
 * 完整打通后端 P1-1 持久化原语：
 * - Series 剧集总括 CRUD
 * - StoryBible 世界观 / 核心冲突 / 人物档案 / 滚动前情摘要编辑
 * - Episode 分集拆条与 Variant 多平台解说变体分支管理
 */

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  projectIpc,
  type CharacterProfile,
  type Episode,
  type Series,
  type StoryBible,
  type Variant,
} from "@dramaxis/ipc";
import { useProject } from "@hooks/project";

export function SeriesManagerPanel() {
  const { project, currentPath } = useProject();
  const qc = useQueryClient();
  const bundlePath = currentPath ?? null;

  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

  // 新建剧集状态
  const [newTitle, setNewTitle] = useState("");
  const [newGenre, setNewGenre] = useState("逆袭爽剧");

  // 设定集编辑状态
  const [bibleForm, setBibleForm] = useState<StoryBible | null>(null);
  const [charName, setCharName] = useState("");
  const [charRole, setCharRole] = useState("主角");
  const [charTraits, setCharTraits] = useState("");

  // 新建分集与变体状态
  const [epTitle, setEpTitle] = useState("");
  const [varLabel, setVarLabel] = useState("悬疑反转版");

  const { data: seriesList = [] } = useQuery({
    queryKey: ["series-list", bundlePath],
    queryFn: () => projectIpc.listSeries(bundlePath),
  });

  useEffect(() => {
    if (!selectedSeriesId && seriesList.length > 0 && seriesList[0]) {
      setSelectedSeriesId(seriesList[0].id);
    }
  }, [seriesList, selectedSeriesId]);

  const { data: loadedBible } = useQuery({
    queryKey: ["story-bible", selectedSeriesId, bundlePath],
    queryFn: () =>
      selectedSeriesId
        ? projectIpc.loadStoryBible(selectedSeriesId, bundlePath)
        : Promise.resolve(null),
    enabled: !!selectedSeriesId,
  });

  useEffect(() => {
    if (!selectedSeriesId) {
      setBibleForm(null);
      return;
    }
    if (loadedBible) {
      setBibleForm(loadedBible);
    } else {
      setBibleForm({
        seriesId: selectedSeriesId,
        worldview: "",
        coreConflict: "",
        narratorPersona: "第一人称冷静旁观，节奏凌厉、金句高频",
        characters: [],
        rollingRecaps: [],
      });
    }
  }, [loadedBible, selectedSeriesId]);

  const { data: episodes = [] } = useQuery({
    queryKey: ["episodes-list", selectedSeriesId, bundlePath],
    queryFn: () =>
      selectedSeriesId
        ? projectIpc.listEpisodes(selectedSeriesId, bundlePath)
        : Promise.resolve([]),
    enabled: !!selectedSeriesId,
  });

  useEffect(() => {
    if (episodes.length > 0 && !episodes.some((e) => e.id === selectedEpisodeId)) {
      setSelectedEpisodeId(episodes[0]?.id ?? null);
    }
  }, [episodes, selectedEpisodeId]);

  const { data: variants = [] } = useQuery({
    queryKey: ["variants-list", selectedEpisodeId, bundlePath],
    queryFn: () =>
      selectedEpisodeId
        ? projectIpc.listVariants(selectedEpisodeId, bundlePath)
        : Promise.resolve([]),
    enabled: !!selectedEpisodeId,
  });

  const handleCreateSeries = async () => {
    const title = newTitle.trim();
    if (!title) {
      toast.error("请输入剧集名称");
      return;
    }
    const now = new Date().toISOString();
    const series: Series = {
      id: `ser_${Date.now()}`,
      title,
      genre: newGenre.trim() || "短剧",
      defaultStyle: "story",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await projectIpc.saveSeries(series, bundlePath);
      setNewTitle("");
      setSelectedSeriesId(series.id);
      void qc.invalidateQueries({ queryKey: ["series-list", bundlePath] });
      toast.success(`已创建剧集《${series.title}》`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("创建剧集失败", { description: err?.message ?? String(e) });
    }
  };

  const handleSaveBible = async () => {
    if (!bibleForm) return;
    try {
      await projectIpc.saveStoryBible(bibleForm, bundlePath);
      void qc.invalidateQueries({
        queryKey: ["story-bible", bibleForm.seriesId, bundlePath],
      });
      toast.success("Story Bible 设定集已保存，将在跨集解说中自动防串戏");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("保存设定集失败", { description: err?.message ?? String(e) });
    }
  };

  const handleAddCharacter = () => {
    if (!bibleForm || !charName.trim()) return;
    const nextChar: CharacterProfile = {
      id: `char_${Date.now()}`,
      name: charName.trim(),
      alias: null,
      roleType: charRole.trim() || "配角",
      traits: charTraits.trim() || "性格鲜明",
      relationships: "",
    };
    setBibleForm({
      ...bibleForm,
      characters: [...bibleForm.characters, nextChar],
    });
    setCharName("");
    setCharTraits("");
  };

  const handleCreateEpisode = async () => {
    if (!selectedSeriesId) return;
    const ep: Episode = {
      id: `ep_${Date.now()}`,
      seriesId: selectedSeriesId,
      episodeNumber: episodes.length + 1,
      title: epTitle.trim() || `第 ${episodes.length + 1} 集`,
      sourcePaths: project?.media_files.map((m) => m.path) ?? [],
      createdAt: new Date().toISOString(),
    };
    try {
      await projectIpc.saveEpisode(ep, bundlePath);
      setEpTitle("");
      setSelectedEpisodeId(ep.id);
      void qc.invalidateQueries({
        queryKey: ["episodes-list", selectedSeriesId, bundlePath],
      });
      toast.success(`已添加分集：${ep.title}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("添加分集失败", { description: err?.message ?? String(e) });
    }
  };

  const handleCreateVariant = async () => {
    if (!selectedEpisodeId) return;
    const variant: Variant = {
      id: `var_${Date.now()}`,
      episodeId: selectedEpisodeId,
      projectId: project?.id ?? "default",
      label: varLabel.trim() || "默认变体",
      stylePreset: "standard",
      targetPlatform: "douyin",
      createdAt: new Date().toISOString(),
    };
    try {
      await projectIpc.saveVariant(variant, bundlePath);
      void qc.invalidateQueries({
        queryKey: ["variants-list", selectedEpisodeId, bundlePath],
      });
      toast.success(`已派生变体分支：${variant.label}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error("创建变体失败", { description: err?.message ?? String(e) });
    }
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <span>📚</span>
            <span>微短剧连载与 Story Bible 设定集 (Series → Episode → Variant)</span>
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            维护跨集人物关系、核心冲突与前情提要，支撑多集连载解说零串戏与一集多变体矩阵
          </p>
        </div>
        <span className="rounded-full bg-gold/15 border border-gold/30 px-2.5 py-0.5 text-[10px] font-bold text-gold">
          Story Bible
        </span>
      </div>

      {/* 剧集创建与切换栏 */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={selectedSeriesId ?? ""}
          onChange={(e) => setSelectedSeriesId(e.target.value || null)}
          className="sm:w-56 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text-primary"
        >
          <option value="">-- 选择剧集 --</option>
          {seriesList.map((s) => (
            <option key={s.id} value={s.id}>
              《{s.title}》({s.genre})
            </option>
          ))}
        </select>

        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="新剧集名 (如：龙神归来)..."
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text-primary"
        />
        <input
          type="text"
          value={newGenre}
          onChange={(e) => setNewGenre(e.target.value)}
          placeholder="题材"
          className="sm:w-28 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text-primary"
        />
        <button
          type="button"
          onClick={() => void handleCreateSeries()}
          className="rounded-lg bg-gold/20 hover:bg-gold/30 border border-gold/40 px-3.5 py-1.5 text-xs font-bold text-gold"
        >
          + 新建剧集
        </button>
      </div>

      {selectedSeriesId && bibleForm && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 左列：Story Bible 世界观与人物表 */}
          <div className="rounded-lg border border-white/5 bg-black/25 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-primary">
                世界观与人物设定集 (Story Bible)
              </span>
              <button
                type="button"
                onClick={() => void handleSaveBible()}
                className="rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-2.5 py-1 text-[10px] font-bold text-emerald-200"
              >
                保存设定集
              </button>
            </div>

            <input
              type="text"
              value={bibleForm.coreConflict}
              onChange={(e) =>
                setBibleForm({ ...bibleForm, coreConflict: e.target.value })
              }
              placeholder="核心冲突 (如：隐忍赘婿三年后身份曝光，打脸豪门)"
              className="w-full rounded border border-border bg-bg px-2.5 py-1.5 text-xs text-text-primary"
            />
            <textarea
              rows={2}
              value={bibleForm.worldview}
              onChange={(e) =>
                setBibleForm({ ...bibleForm, worldview: e.target.value })
              }
              placeholder="世界观 / 故事背景摘要..."
              className="w-full rounded border border-border bg-bg px-2.5 py-1.5 text-xs text-text-primary resize-none"
            />

            {/* 人物档案 */}
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  placeholder="角色名"
                  className="w-24 rounded border border-border bg-bg px-2 py-1 text-[11px] text-text-primary"
                />
                <input
                  type="text"
                  value={charRole}
                  onChange={(e) => setCharRole(e.target.value)}
                  placeholder="定位"
                  className="w-20 rounded border border-border bg-bg px-2 py-1 text-[11px] text-text-primary"
                />
                <input
                  type="text"
                  value={charTraits}
                  onChange={(e) => setCharTraits(e.target.value)}
                  placeholder="人物特质"
                  className="flex-1 rounded border border-border bg-bg px-2 py-1 text-[11px] text-text-primary"
                />
                <button
                  type="button"
                  onClick={handleAddCharacter}
                  className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-text-primary hover:bg-white/10"
                >
                  + 角色
                </button>
              </div>
              {bibleForm.characters.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {bibleForm.characters.map((c) => (
                    <span
                      key={c.id}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-text-secondary"
                    >
                      {c.name} ({c.roleType}) · {c.traits}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右列：分集与解说变体分支 */}
          <div className="rounded-lg border border-white/5 bg-black/25 p-3 space-y-2.5">
            <div className="text-[11px] font-bold text-text-primary">
              分集 (Episodes) 与 变体分支 (Variants)
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={epTitle}
                onChange={(e) => setEpTitle(e.target.value)}
                placeholder={`新分集标题 (默认第 ${episodes.length + 1} 集)`}
                className="flex-1 rounded border border-border bg-bg px-2.5 py-1 text-xs text-text-primary"
              />
              <button
                type="button"
                onClick={() => void handleCreateEpisode()}
                className="rounded border border-indigo-500/40 bg-indigo-500/20 px-2.5 py-1 text-[10px] font-bold text-indigo-200"
              >
                + 添加分集
              </button>
            </div>

            {episodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {episodes.map((ep) => (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => setSelectedEpisodeId(ep.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] border transition-all ${
                      selectedEpisodeId === ep.id
                        ? "bg-indigo-500/25 border-indigo-400 text-indigo-100 font-bold"
                        : "bg-white/5 border-white/10 text-text-muted hover:text-text-primary"
                    }`}
                  >
                    E{ep.episodeNumber} · {ep.title}
                  </button>
                ))}
              </div>
            )}

            {selectedEpisodeId && (
              <div className="pt-1 border-t border-white/5 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={varLabel}
                    onChange={(e) => setVarLabel(e.target.value)}
                    placeholder="变体标签 (如：悬疑钩子版 / 吐槽版)"
                    className="flex-1 rounded border border-border bg-bg px-2.5 py-1 text-xs text-text-primary"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateVariant()}
                    className="rounded border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-200"
                  >
                    + 派生变体
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variants.map((v) => (
                    <span
                      key={v.id}
                      className="rounded bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[10px] text-amber-200"
                    >
                      🌿 {v.label} ({v.targetPlatform ?? "douyin"})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
