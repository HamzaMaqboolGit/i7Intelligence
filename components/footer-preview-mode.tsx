"use client";
import { useEffect } from "react";
export default function FooterPreviewMode() {
  useEffect(() => {
    if (new URLSearchParams(location.search).get("footerPreview") === "1") {
      document.documentElement.classList.add("footer-preview-mode");
    }
    return () =>
      document.documentElement.classList.remove("footer-preview-mode");
  }, []);
  return null;
}
