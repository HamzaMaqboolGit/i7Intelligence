"use client";
import { Toaster } from "sonner";
import { MotionConfig } from "framer-motion";
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster
        position="top-right"
        closeButton
        visibleToasts={3}
        duration={4500}
        toastOptions={{
          className: "agency-toast",
          style: {
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            boxShadow: "var(--shadow)",
          },
        }}
      />
    </MotionConfig>
  );
}
