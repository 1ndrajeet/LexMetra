// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public/uploads");

export async function POST(req: NextRequest) {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const formData = await req.formData();
    const file = formData.get("image") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Compress to 1200px width, JPEG quality 80
    const compressed = await sharp(buffer)
      .resize(1200, null, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();

    const filename = `${Date.now()}-${file.name.replace(/\s/g, "-")}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await writeFile(filepath, compressed);

    return NextResponse.json({
      url: `/uploads/${filename}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}