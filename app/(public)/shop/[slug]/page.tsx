import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/cms/store";
import Product from "@/components/store/product";
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await prisma.storeProduct.findFirst({
    where: { slug, status: "published", deletedAt: null },
  });
  if (!row) notFound();
  return <Product product={serialize(row)} />;
}
