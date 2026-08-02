import { getServerEnv } from "@/lib/env";

const API_BASE = "https://api.figma.com/v1";

export interface FigmaFileResponse {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
}

export interface FigmaImagesResponse {
  err: string | null;
  images: Record<string, string | null>;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

class FigmaError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "FigmaError";
  }
}

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        return (await res.json()) as T;
      }

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
        await new Promise((resolve) =>
          setTimeout(resolve, retryAfter * 1000 * (attempt + 1)),
        );
        continue;
      }

      if (res.status >= 500 && res.status < 600) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        );
        continue;
      }

      const text = await res.text();
      throw new FigmaError(res.status, `Figma API ${res.status}: ${text}`);
    } catch (err) {
      lastError =
        err instanceof Error ? err : new Error(String(err), { cause: err });
      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        );
      }
    }
  }
  throw lastError ?? new Error("Figma API request failed");
}

function authHeaders() {
  const token = getServerEnv().FIGMA_ACCESS_TOKEN;
  if (!token) {
    throw new Error("FIGMA_ACCESS_TOKEN is not configured in .env.local");
  }
  return {
    "X-Figma-Token": token,
  };
}

export async function getFile(
  fileKey: string,
  { depth }: { depth?: number } = {},
): Promise<FigmaFileResponse> {
  const params = new URLSearchParams();
  if (depth !== undefined) params.set("depth", String(depth));
  const query = params.toString();
  const url = `${API_BASE}/files/${fileKey}${query ? `?${query}` : ""}`;
  return fetchWithRetry<FigmaFileResponse>(url, { headers: authHeaders() });
}

export async function getFileNodes(
  fileKey: string,
  nodeIds: string[],
): Promise<Record<string, { document: FigmaNode }>> {
  if (nodeIds.length === 0) return {};
  const ids = nodeIds.map((id) => id.replace(":", "-")).join(",");
  const url = `${API_BASE}/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}&depth=-1`;
  const data = (await fetchWithRetry<{
    nodes: Record<string, { document: FigmaNode }>;
  }>(url, { headers: authHeaders() })).nodes;
  return data;
}

export async function getImages(
  fileKey: string,
  nodeIds: string[],
  { scale = 1, format = "png" }: { scale?: number; format?: "png" | "svg" | "pdf" } = {},
): Promise<FigmaImagesResponse> {
  if (nodeIds.length === 0) {
    return { err: null, images: {} };
  }
  const ids = nodeIds.map((id) => id.replace(":", "-")).join(",");
  const url = `${API_BASE}/images/${fileKey}?ids=${encodeURIComponent(ids)}&scale=${scale}&format=${format}`;
  return fetchWithRetry<FigmaImagesResponse>(url, { headers: authHeaders() });
}
