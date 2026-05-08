import prisma from "../db.server";

export async function ensureShopSettings(shop: string) {
  return prisma.shopSettings.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      companyName: shop.replace(".myshopify.com", ""),
    },
  });
}

export async function findPublicShop(shop?: string | null) {
  if (shop) {
    const exactShop = await prisma.shopSettings.findUnique({ where: { shop } });
    if (exactShop) return exactShop;
  }

  return prisma.shopSettings.findFirst({ orderBy: { createdAt: "asc" } });
}
