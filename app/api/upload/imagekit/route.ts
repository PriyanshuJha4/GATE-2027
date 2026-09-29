import { NextRequest, NextResponse } from "next/server";
import ImageKit from "imagekit";

export const dynamic = "force-dynamic";

function getImageKitClient() {
  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || process.env.IMAGEKIT_URL_ENDPOINT;

  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error("ImageKit configuration keys are missing");
  }

  return new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint,
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileName = (formData.get("fileName") as string) || file?.name || "upload";
    const folder = (formData.get("folder") as string) || "/gate-2027";

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const imagekit = getImageKitClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const response = await imagekit.upload({
      file: buffer,
      fileName,
      folder,
      useUniqueFileName: true,
    });

    return NextResponse.json({
      url: response.url,
      fileId: response.fileId,
      name: response.name,
      size: response.size,
    });
  } catch (error: any) {
    console.error("ImageKit Upload Error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}