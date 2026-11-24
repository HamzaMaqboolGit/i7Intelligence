import Orders from "@/components/store/orders";
export const metadata = {
  title: "Private order",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return <Orders reference={reference} />;
}
