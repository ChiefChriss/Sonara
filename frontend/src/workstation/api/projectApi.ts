// API service for project save/load and publishing
// Endpoints follow the pattern: ${API_BASE_URL}/api/auth/...

const getApiBase = () => 
    import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const getHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const getAuthHeader = () => {
  const token = localStorage.getItem('accessToken');
  return { 'Authorization': `Bearer ${token}` };
};

// ═══════════════════════════════════════════
// Project endpoints (save/load DAW state)
// ═══════════════════════════════════════════

export interface ProjectSummary {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectFull extends ProjectSummary {
  data: any; // Full DAW state
}

/** List all user's projects (lightweight, no data payload) */
export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(`${getApiBase()}/api/auth/projects/`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to list projects');
  return res.json();
}

/** Get a single project with full data */
export async function getProject(id: number): Promise<ProjectFull> {
  const res = await fetch(`${getApiBase()}/api/auth/projects/${id}/`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to load project');
  return res.json();
}

/** Create a new project */
export async function createProject(name: string, data: any): Promise<ProjectFull> {
  const res = await fetch(`${getApiBase()}/api/auth/projects/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, data }),
  });
  if (!res.ok) throw new Error('Failed to create project');
  return res.json();
}

/** Update (save) an existing project */
export async function saveProject(id: number, name: string, data: any): Promise<ProjectFull> {
  const res = await fetch(`${getApiBase()}/api/auth/projects/${id}/`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ name, data }),
  });
  if (!res.ok) throw new Error('Failed to save project');
  return res.json();
}

/** Delete a project */
export async function deleteProject(id: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/auth/projects/${id}/`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete project');
}

// ═══════════════════════════════════════════
// Publication endpoints
// ═══════════════════════════════════════════

export interface Publication {
  id: number;
  title: string;
  description: string;
  audio_file: string;
  cover_image: string | null;
  is_public: boolean;
  play_count: number;
  published_at: string;
  project: number | null;
  username: string;
  profile_picture: string | null;
}

/** Publish a song — upload rendered audio + metadata */
export async function publishSong(
  audioBlob: Blob,
  title: string,
  description: string,
  projectId?: number,
  coverImage?: File,
): Promise<Publication> {
  const formData = new FormData();
  formData.append('audio_file', audioBlob, `${title}.mp3`);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('is_public', 'true');
  if (projectId) formData.append('project', String(projectId));
  if (coverImage) formData.append('cover_image', coverImage);

  const res = await fetch(`${getApiBase()}/api/auth/publications/`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || 'Failed to publish');
  }
  return res.json();
}

/** List the current user's publications */
export async function listMyPublications(): Promise<Publication[]> {
  const res = await fetch(`${getApiBase()}/api/auth/publications/`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to list publications');
  return res.json();
}

/** Delete a publication */
export async function deletePublication(id: number): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/auth/publications/${id}/`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete publication');
}

/** Public feed — no auth required */
export async function getPublicFeed(): Promise<Publication[]> {
  const res = await fetch(`${getApiBase()}/api/auth/feed/`);
  if (!res.ok) throw new Error('Failed to load feed');
  return res.json();
}

/** Get a user's public publications — no auth required */
export async function getUserPublications(username: string): Promise<Publication[]> {
  const res = await fetch(`${getApiBase()}/api/auth/users/${username}/publications/`);
  if (!res.ok) throw new Error('Failed to load user publications');
  return res.json();
}

/** Increment play count */
export async function recordPlay(publicationId: number): Promise<void> {
  await fetch(`${getApiBase()}/api/auth/publications/${publicationId}/play/`, {
    method: 'POST',
  });
}