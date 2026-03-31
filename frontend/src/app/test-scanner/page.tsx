"use client";

import { useState, useEffect } from "react";
import ShelfScanner from "@/components/scanner/ShelfScanner";

export default function TestScannerPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="fixed inset-0 z-50 bg-black" />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <ShelfScanner
        visitId="test-visit-id"
        storeId="test-store-id"
        onComplete={(scanId) => alert(`Scan complete: ${scanId}`)}
        onCancel={() => window.history.back()}
      />
    </div>
  );
}
