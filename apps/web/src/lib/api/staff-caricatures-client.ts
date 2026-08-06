import type {
  StaffCaricatureApproveResponse,
  StaffCaricatureDeleteResponse,
  StaffCaricatureDetail,
  StaffCaricatureRejectResponse,
} from "@/lib/api/staff-caricatures-types"
import type { CaricatureAssetMetadataPayload } from "@/lib/caricatures/caricature-upload-metadata"

export class StaffCaricaturesClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message)
    this.name = "StaffCaricaturesClientError"
  }
}

interface StaffCaricaturesErrorBody {
  error?: { code?: string; message?: string }
}

async function readStaffCaricaturesError(response: Response): Promise<{ code?: string; message: string }> {
  try {
    const body = (await response.json()) as StaffCaricaturesErrorBody
    return {
      code: body.error?.code,
      message: body.error?.message ?? "Staff caricatures request failed.",
    }
  } catch {
    return { message: "Staff caricatures request failed." }
  }
}

async function staffCaricaturesJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/staff/caricatures${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const error = await readStaffCaricaturesError(response)
    throw new StaffCaricaturesClientError(response.status, error.code, error.message)
  }

  return response.json() as Promise<T>
}

export function fetchStaffCaricatureDetail(assetId: string): Promise<StaffCaricatureDetail> {
  return staffCaricaturesJson<StaffCaricatureDetail>(`/${encodeURIComponent(assetId)}`)
}

export function updateStaffCaricatureClient(
  assetId: string,
  payload: CaricatureAssetMetadataPayload,
): Promise<StaffCaricatureDetail> {
  return staffCaricaturesJson<StaffCaricatureDetail>(`/${encodeURIComponent(assetId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function deleteStaffCaricatureClient(assetId: string): Promise<StaffCaricatureDeleteResponse> {
  return staffCaricaturesJson<StaffCaricatureDeleteResponse>(`/${encodeURIComponent(assetId)}`, {
    method: "DELETE",
  })
}

export function approveStaffCaricatureClient(assetId: string): Promise<StaffCaricatureApproveResponse> {
  return staffCaricaturesJson<StaffCaricatureApproveResponse>(
    `/${encodeURIComponent(assetId)}/approve`,
    { method: "POST" },
  )
}

export function rejectStaffCaricatureClient(assetId: string): Promise<StaffCaricatureRejectResponse> {
  return staffCaricaturesJson<StaffCaricatureRejectResponse>(
    `/${encodeURIComponent(assetId)}/reject`,
    { method: "POST" },
  )
}
