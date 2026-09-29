import { NextRequest, NextResponse } from "next/server";
import { Client, Storage, ID } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const storage = new Storage(client);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileName = (formData.get("fileName") as string) || file?.name || "file";

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const bucketId = process.env.APPWRITE_BUCKET_ID!;
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Standard web File instance (compatible with node-appwrite)
    const uploadPayload = new File([buffer], fileName, {
      type: file.type || "application/octet-stream",
    });

    const uploadedFile = await (storage as any).createFile(
      bucketId,
      ID.unique(),
      uploadPayload
    );

    const fileUrl = `${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${uploadedFile.$id}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;

    return NextResponse.json({
      url: fileUrl,
      fileId: uploadedFile.$id,
      name: uploadedFile.name,
      size: uploadedFile.sizeOriginal,
    });
  } catch (error: any) {
    console.error("Appwrite Upload Error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}