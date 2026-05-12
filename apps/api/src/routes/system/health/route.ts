import type { HealthResponseDto } from "../../../lib/dtos";
import { json } from "../../../lib/http";

export async function healthRoute(): Promise<Response> {
  const body: HealthResponseDto = {
    ok: true,
    service: "fotocorp-api",
    environment: "fixture",
    version: "provisional"
  };

  return json(body);
}
