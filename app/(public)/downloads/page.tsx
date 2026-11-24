import Orders from "@/components/store/orders";
export const metadata = {
  title: "Private downloads",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Orders />;
}
