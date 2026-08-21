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

export interface FigmaProjectFile {
  key: string;
  name: string;
  thumbnail_url?: string;
  last_modified?: string;
}

/** List every file (= Module) in a Figma project. Requires a token with
 *  read access to the project. */
export async function getProjectFiles(
  projectId: string,
): Promise<FigmaProjectFile[]> {
  const url = `${API_BASE}/projects/${projectId}/files`;
  const data = await fetchWithRetry<{ files: FigmaProjectFile[] }>(url, {
    headers: authHeaders(),
  });
  return data.files ?? [];
}

/**
 * ⚠️ LEGACY FALLBACK — direct (root/top-level) folder file listing only.
 *
 * The official current API for folders is Figma's **v2 Folder API**
 * (`GET /v2/folders/:id/files`, `.../folders`, `.../meta`, `GET /v2/teams/:id/folders`),
 * which supports true recursive subfolder enumeration. Those endpoints require
 * the **`folders:read`** OAuth scope. Probed 2026-08-21 with the current
 * Personal Access Token (`figd_…`): every v2 folder endpoint returned **403
 * "requires the folders:read scope"** (the token grants projects:read /
 * file_content:read / … but NOT folders:read); `/v2/folders/:id/meta` → 401.
 * See scripts/probe-folder-api-v2.ts.
 *
 * Because v2 is unavailable to this credential, we fall back to the DEPRECATED
 * `/v1/projects/:id/files` endpoint, which still resolves a folder id and
 * returns that folder's **direct** file set. LIMITATION: this path discovers
 * only files directly under the given folder id — it CANNOT enumerate nested
 * subfolders. If NBF-MODULES gains subfolders, their files will be missed until
 * either (a) the credential is granted `folders:read` and this migrates to v2,
 * or (b) the subfolder ids are added manually to FIGMA_NBF_FOLDER_ID.
 */
export async function getFolderFiles(
  folderId: string,
): Promise<{ name: string; files: FigmaProjectFile[] }> {
  // LEGACY FALLBACK endpoint (deprecated). See doc comment above.
  const url = `${API_BASE}/projects/${folderId}/files`;
  const data = await fetchWithRetry<{ name?: string; files?: FigmaProjectFile[] }>(url, {
    headers: authHeaders(),
  });
  return { name: data.name ?? "", files: data.files ?? [] };
}

/**
 * Collect every file beneath one or more configured folder ids, deduped by
 * Figma file key. Returns the merged folder name(s) and file set.
 *
 * ⚠️ LEGACY FALLBACK: recursion is NOT automatic. Because the v2 Folder API
 * (which would enumerate subfolders) is blocked by the missing `folders:read`
 * scope, subfolders must be listed explicitly (comma-separated
 * FIGMA_NBF_FOLDER_ID) as an emergency mechanism. When the credential gains
 * `folders:read`, replace getFolderFiles with a v2 `collectFolder(root)` that
 * fetches `/v2/folders/:id/files` + `/v2/folders/:id/folders` and recurses,
 * requiring the WHOLE tree to fetch successfully before the key set is treated
 * as authoritative for reconciliation.
 */
export async function collectFolderFiles(
  folderIds: string[],
): Promise<{ names: string[]; files: FigmaProjectFile[] }> {
  const byKey = new Map<string, FigmaProjectFile>();
  const names: string[] = [];
  for (const id of folderIds) {
    const { name, files } = await getFolderFiles(id);
    if (name) names.push(name);
    for (const f of files) byKey.set(f.key, f);
  }
  return { names, files: [...byKey.values()] };
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
