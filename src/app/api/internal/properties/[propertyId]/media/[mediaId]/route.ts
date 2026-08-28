import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/session";
import {
  canViewPropertyMedia,
  createPropertyAssetsService,
} from "@/server/services/property-assets-service";

type RouteContext = Readonly<{
  params: Promise<{
    propertyId: string;
    mediaId: string;
  }>;
}>;

export const runtime = "nodejs";

export async function GET(_: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!canViewPropertyMedia(user)) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  const { mediaId, propertyId } = await context.params;
  const assetsService = createPropertyAssetsService();
  const result = await assetsService.getMediaFile(propertyId, mediaId);

  if (!result) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.object.body), {
    headers: {
      "Content-Length": String(result.object.contentLength),
      "Content-Type": result.object.contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
