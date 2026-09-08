// app/api/user/image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { updateUserImage } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { image } = await req.json();
        if (!image) return NextResponse.json({ error: "No image" }, { status: 400 });

        // Validate base64 size (max 1MB)
        const sizeInBytes = Buffer.byteLength(image, "base64");
        if (sizeInBytes > 1024 * 1024) {
            return NextResponse.json({ error: "Image too large (max 1MB)" }, { status: 400 });
        }

        const user = await updateUserImage(session.user.id, image);
        if (!user) return NextResponse.json({ error: "Update failed" }, { status: 500 });

        return NextResponse.json({ user });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update image" }, { status: 500 });
    }
}