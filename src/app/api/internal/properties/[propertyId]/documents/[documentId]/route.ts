import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/session";
import {
  canViewPropertyDocument,
  createPropertyAssetsService,
} from "@/server/services/property-assets-service";

type RouteContext = Readonly<{
  params: Promise<{
    propertyId: string;
    documentId: string;
  }>;
}>;

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!canViewPropertyDocument(user)) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  const { documentId, propertyId } = await context.params;
  const assetsService = createPropertyAssetsService();
  const result = await assetsService.getDocumentFile(propertyId, documentId);

  if (!result) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const isDownload = new URL(request.url).searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(result.object.body), {
    headers: {
      "Content-Length": String(result.object.contentLength),
      "Content-Type": result.object.contentType,
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${result.document.originalFilename}"`,
    },
  });
}
