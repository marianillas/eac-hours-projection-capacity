// ClickUp workspace structure, transcribed from the "At a Glance" handoff spec (section 1),
// confirmed via the ClickUp API on 2026-08-28.
//
// IMPORTANT: classification is keyed by ClickUp space/folder ID, never by name. IDs never
// change when something is renamed in ClickUp; names do. If this is ever changed to match
// by name instead, a rename will silently stop counting that space's hours (no error) — so
// any new space/folder added here must be keyed by its ID.

export const WORKSPACE_ID = "9016596870";

export type Category = "eac_core" | "overhead" | "lip_core" | "lip_overhead";

export const LIP_WORLD_SPACE_ID = "90163342800";

// Top-level spaces. LIP World is classified per-folder instead (see LIP_FOLDER_CLASSIFICATION)
// so it has no entry here.
export const SPACE_CLASSIFICATION: Record<string, Category> = {
  "90162180301": "eac_core", // Projects (all client folders under here)
  "90165982599": "eac_core", // Business Development
  "90162212548": "overhead", // Finance and Budgeting
  "90162499248": "overhead", // EAC Core Materials
  "90162824231": "overhead", // Contacts
  "90165908570": "overhead", // Social Media
  "90166865908": "overhead", // Operations
  "90162815262": "overhead", // Marketing
  "90162252295": "overhead", // EAC
};

// Folders within LIP World (space id: LIP_WORLD_SPACE_ID). Matches the eac-lip-utilization
// dashboard's EAC/LIP core-vs-overhead split, for consistency between the two apps.
export const LIP_FOLDER_CLASSIFICATION: Record<string, Category> = {
  "90167311476": "lip_core", // LIP - Partners
  "90165552383": "lip_core", // LIP Prospects
  "90168739580": "lip_core", // LIP Event (SoNV)
  "90168509808": "lip_core", // LIP Events (NoNV)
  "90168739563": "lip_core", // LIP Event (Networking)
  "90167311485": "lip_overhead", // LIP - Admin
  "90167338165": "lip_overhead", // LIP Financials
  "90167989962": "lip_overhead", // LIP Social Media
  "90167996940": "lip_overhead", // LIP Marketing
};

/**
 * Classifies a time entry by the space/folder its task lives in (from the entry's
 * `task_location`). Returns null for a space/folder not covered by the maps above —
 * callers should treat that as "unclassified" and surface it rather than drop it.
 */
export function classifyLocation(spaceId: string | null | undefined, folderId: string | null | undefined): Category | null {
  if (!spaceId) return null;
  if (spaceId === LIP_WORLD_SPACE_ID) {
    return folderId ? (LIP_FOLDER_CLASSIFICATION[folderId] ?? null) : null;
  }
  return SPACE_CLASSIFICATION[spaceId] ?? null;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  eac_core: "EAC Core",
  overhead: "Overhead",
  lip_core: "LIP Core",
  lip_overhead: "LIP Overhead",
};

// Core/overhead policy target (per Ria's time allocation policy memo) — a reference line,
// not a hard input.
export const CORE_TARGET_PCT = 0.7;
export const OVERHEAD_TARGET_PCT = 0.3;
