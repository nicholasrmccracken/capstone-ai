"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface ResizeHandleProps {
  onResize: (deltaX: number) => void;
}

const ResizeHandle = ({ onResize }: ResizeHandleProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pendingDeltaRef = useRef(0);

  const updateSize = useCallback(() => {
    if (pendingDeltaRef.current !== 0) {
      onResize(pendingDeltaRef.current);
      pendingDeltaRef.current = 0;
    }
    rafRef.current = null;
  }, [onResize]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startXRef.current;
      startXRef.current = e.clientX;
      pendingDeltaRef.current += deltaX;

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(updateSize);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Apply any pending changes
      if (pendingDeltaRef.current !== 0) {
        onResize(pendingDeltaRef.current);
        pendingDeltaRef.current = 0;
      }
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isDragging, updateSize, onResize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    pendingDeltaRef.current = 0;
    setIsDragging(true);
  };

  return (
    <div className="flex items-center justify-center flex-shrink-0" style={{ width: '4px' }}>
      <div
        className={`w-1 h-48 rounded-full flex-shrink-0 cursor-col-resize hover:bg-blue-400 transition-colors ${
          isDragging ? "bg-blue-400" : "bg-gray-400"
        }`}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

export default ResizeHandle;
