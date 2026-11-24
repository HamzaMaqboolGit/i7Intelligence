import { Wrench } from "lucide-react";

export default function MaintenancePage({
  name = "Our website",
}: {
  name?: string;
}) {
  return (
    <main className="maintenance-page">
      <div className="maintenance-card">
        <div className="maintenance-icon"><Wrench size={24} /></div>
        <p className="maintenance-kicker">{name}</p>
        <h1>We’ll be back shortly.</h1>
        <p>We’re making a few improvements behind the scenes. Please check back soon.</p>
      </div>
    </main>
  );
}
