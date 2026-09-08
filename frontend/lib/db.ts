// lib/db.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
});

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function checkDatabaseStatus() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { connected: true };
    } catch {
        return { connected: false };
    }
}
export async function updateUserImage(userId: string, imageBase64: string) {
    try {
        const user = await prisma.user.update({
            where: { id: userId },
            data: { image: imageBase64 },
            select: { id: true, name: true, email: true, image: true },
        });
        return user;
    } catch (error) {
        console.error("Error updating user image:", error);
        return null;
    }
}
