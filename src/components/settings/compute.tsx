/**
 * dramaxis · settings/compute.tsx · 局域网 / 私有 GPU 算力池节点管理与健康探测 (P2-3)
 *
 * 接入后端 `computeIpc.checkHealth`，允许独立 GPU 工作站或私有算力节点承接
 * Ollama / vLLM、Whisper ASR、GPT-SoVITS、UVR 人声分离等高负载算子。
 */

import { useState } from "react";
import { Card } from "@dramaxis/ui";
import { toast } from "sonner";
import {
  computeIpc,
  type ComputeHealth,
  type ComputeNodeConfig,
  type ComputeNodeKind,
} from "@dramaxis/ipc";

const STORAGE_KEY = "dramaxis.compute_nodes.v1";

const KIND_META: Record<
  ComputeNodeKind,
  { label: string; icon: string; defaultUrl: string }
> = {
  llm_server: {
    label: "LLM 推理节点 (Ollama / vLLM)",
    icon: "🧠",
    defaultUrl: "http://127.0.0.1:11434",
  },
  whisper_asr: {
    label: "Whisper / SenseVoice ASR 节点",
    icon: "👂",
    defaultUrl: "http://127.0.0.1:8000",
  },
  tts_engine: {
    label: "GPT-SoVITS / CosyVoice TTS 节点",
    icon: "🎙️",
    defaultUrl: "http://127.0.0.1:9880",
  },
  vocal_separator: {
    label: "UVR / Demucs 人声分离节点",
    icon: "🎚️",
    defaultUrl: "http://127.0.0.1:9000",
  },
};

function loadInitialNodes(): ComputeNodeConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ComputeNodeConfig[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return [
    {
      id: "local-ollama",
      name: "本机 Ollama 节点",
      kind: "llm_server",
      endpointUrl: "http://127.0.0.1:11434",
      apiKey: null,
      modelName: "qwen2.5:14b",
      isActive: true,
      priority: 1,
    },
    {
      id: "lan-sovits",
      name: "工作室 GPU GPT-SoVITS",
      kind: "tts_engine",
      endpointUrl: "http://127.0.0.1:9880",
      apiKey: null,
      modelName: null,
      isActive: false,
      priority: 2,
    },
  ];
}

export function ComputeNodesSection() {
  const [nodes, setNodes] = useState<ComputeNodeConfig[]>(loadInitialNodes);
  const [healthMap, setHealthMap] = useState<Record<string, ComputeHealth>>({});
  const [probingId, setProbingId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<ComputeNodeKind>("whisper_asr");
  const [newUrl, setNewUrl] = useState(KIND_META.whisper_asr.defaultUrl);
  const [newModel, setNewModel] = useState("");

  const persistNodes = (next: ComputeNodeConfig[]) => {
    setNodes(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleAddNode = () => {
    const url = newUrl.trim();
    if (!url) {
      toast.error("请输入节点 Endpoint URL");
      return;
    }
    const node: ComputeNodeConfig = {
      id: `node-${Date.now()}`,
      name: newName.trim() || KIND_META[newKind].label,
      kind: newKind,
      endpointUrl: url,
      apiKey: null,
      modelName: newModel.trim() || null,
      isActive: true,
      priority: nodes.length + 1,
    };
    persistNodes([...nodes, node]);
    setNewName("");
    setNewModel("");
    toast.success(`已添加算力节点：${node.name}`);
  };

  const handleToggleActive = (id: string) => {
    persistNodes(
      nodes.map((n) => (n.id === id ? { ...n, isActive: !n.isActive } : n)),
    );
  };

  const handleRemove = (id: string) => {
    persistNodes(nodes.filter((n) => n.id !== id));
  };

  const handleCheckHealth = async (node: ComputeNodeConfig) => {
    setProbingId(node.id);
    try {
      const res = await computeIpc.checkHealth(node);
      setHealthMap((prev) => ({ ...prev, [node.id]: res }));
      if (res.isHealthy) {
        toast.success(`${node.name} 连通正常`, {
          description: `延迟 ${res.latencyMs}ms · ${res.message}`,
        });
      } else {
        toast.warning(`${node.name} 探测异常`, {
          description: res.message,
        });
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(`节点探测失败：${node.name}`, {
        description: err?.message ?? String(e),
      });
    } finally {
      setProbingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <span>🖥️</span>
              <span>局域网 / 私有 GPU 算力节点池</span>
            </h3>
            <p className="text-xs text-text-muted mt-1">
              将 Whisper 转写、Ollama 大模型、GPT-SoVITS 配音与 UVR 人声分离卸载至局域网 GPU 工作站
            </p>
          </div>
          <span className="rounded-full bg-gold/15 border border-gold/30 px-2.5 py-0.5 text-[10px] font-bold text-gold">
            Local-First Cluster
          </span>
        </div>

        {/* 已有节点列表 */}
        <div className="space-y-2.5">
          {nodes.map((node) => {
            const meta = KIND_META[node.kind];
            const health = healthMap[node.id];
            return (
              <div
                key={node.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised/40 p-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{meta.icon}</span>
                    <span className="text-xs font-bold text-text-primary truncate">
                      {node.name}
                    </span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-text-muted">
                      {meta.label}
                    </span>
                    {health && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          health.isHealthy
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-red-500/15 text-red-300 border border-red-500/30"
                        }`}
                      >
                        {health.isHealthy
                          ? `在线 · ${health.latencyMs}ms`
                          : "不可达"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-text-muted truncate">
                    <span>{node.endpointUrl}</span>
                    {node.modelName && <span>模型: {node.modelName}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(node.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-all ${
                      node.isActive
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                        : "bg-white/5 border-white/10 text-text-muted"
                    }`}
                  >
                    {node.isActive ? "已启用" : "已停用"}
                  </button>
                  <button
                    type="button"
                    disabled={probingId === node.id}
                    onClick={() => handleCheckHealth(node)}
                    className="rounded-lg bg-gold/15 hover:bg-gold/25 border border-gold/30 px-2.5 py-1 text-[11px] font-bold text-gold transition-all disabled:opacity-50"
                  >
                    {probingId === node.id ? "探测中..." : "健康探测"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(node.id)}
                    className="rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 px-2 py-1 text-[11px] text-text-muted hover:text-red-300 transition-all"
                  >
                    移除
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 新增节点表单 */}
        <div className="rounded-xl border border-dashed border-border p-3 space-y-2.5">
          <div className="text-[11px] font-bold text-text-secondary">
            + 注册局域网 / 本地算力节点
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <select
              value={newKind}
              onChange={(e) => {
                const k = e.target.value as ComputeNodeKind;
                setNewKind(k);
                setNewUrl(KIND_META[k].defaultUrl);
              }}
              className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text-primary"
            >
              {(Object.keys(KIND_META) as ComputeNodeKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_META[k].label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="节点别名 (如 4090工作站)"
              className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text-primary"
            />
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="http://192.168.1.50:8000"
              className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-mono text-text-primary"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="模型名 (可选)"
                className="w-full rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text-primary"
              />
              <button
                type="button"
                onClick={handleAddNode}
                className="shrink-0 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-zinc-950 hover:brightness-110"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
