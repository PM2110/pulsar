import React, { useEffect, useRef } from "react";

interface InfiniteScrollProps {
  onIntersect: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

export const InfiniteScroll = ({ onIntersect, hasMore, isLoading }: InfiniteScrollProps) => {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!triggerRef.current || !hasMore || isLoading) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        onIntersect();
      }
    }, { rootMargin: "100px" });

    observer.observe(triggerRef.current);
    
    return () => observer.disconnect();
  }, [onIntersect, hasMore, isLoading]);

  if (!hasMore) return null;

  return (
    <div ref={triggerRef} style={{ padding: 24, textAlign: "center" }}>
      {isLoading ? (
        <span style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
          <div className="spinner" style={{ width: 12, height: 12, borderTopColor: "var(--processing)" }} /> 
          Loading more...
        </span>
      ) : (
        <div style={{ height: 1 }} />
      )}
    </div>
  );
};
