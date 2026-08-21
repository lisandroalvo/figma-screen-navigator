"use client";

import { useState, useEffect, useRef } from "react";
import {
  createHotspotAction,
  deleteHotspotAction,
  listHotspotsByInteractionAction,
} from "@/app/admin/flows/actions";
import Image from "next/image";

interface Hotspot {
  id: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export default function HotspotEditor({
  interactionId,
  previewUrl,
  onClose,
}: {
  interactionId: string;
  previewUrl: string;
  onClose: () => void;
}) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHotspots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactionId]);

  async function loadHotspots() {
    const data = await listHotspotsByInteractionAction(interactionId);
    setHotspots(data);
  }

  function getImageCoordinates(clientX: number, clientY: number) {
    if (!imageRef.current || !containerRef.current) return null;

    const rect = imageRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(x, rect.width));
    const clampedY = Math.max(0, Math.min(y, rect.height));

    return {
      x: clampedX,
      y: clampedY,
      imageWidth: rect.width,
      imageHeight: rect.height,
    };
  }

  function handleMouseDown(e: React.MouseEvent) {
    const coords = getImageCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    setDrawing(true);
    setStartPos({ x: coords.x, y: coords.y });
    setCurrentRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!drawing || !startPos) return;

    const coords = getImageCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    const width = coords.x - startPos.x;
    const height = coords.y - startPos.y;

    setCurrentRect({
      x: width >= 0 ? startPos.x : coords.x,
      y: height >= 0 ? startPos.y : coords.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  }

  async function handleMouseUp() {
    if (!drawing || !currentRect || !imageRef.current) return;

    setDrawing(false);

    const rect = imageRef.current.getBoundingClientRect();

    // Convert to percentages
    const xPercent = currentRect.x / rect.width;
    const yPercent = currentRect.y / rect.height;
    const widthPercent = currentRect.width / rect.width;
    const heightPercent = currentRect.height / rect.height;

    // Minimum size check
    if (widthPercent < 0.01 || heightPercent < 0.01) {
      setCurrentRect(null);
      setStartPos(null);
      return;
    }

    setLoading(true);
    try {
      await createHotspotAction({
        interactionId,
        xPercent,
        yPercent,
        widthPercent,
        heightPercent,
      });

      setCurrentRect(null);
      setStartPos(null);
      await loadHotspots();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this hotspot?")) return;

    setLoading(true);
    try {
      await deleteHotspotAction(id);
      await loadHotspots();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Hotspot Editor</h3>
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
        >
          Close
        </button>
      </div>

      <div className="mb-4 text-sm text-gray-600">
        Click and drag on the image to create a hotspot rectangle.
      </div>

      <div
        ref={containerRef}
        className="relative border rounded-lg overflow-hidden bg-gray-50 mb-4"
        style={{ cursor: drawing ? "crosshair" : "default" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (drawing) handleMouseUp();
        }}
      >
        <Image
          ref={imageRef}
          src={previewUrl}
          alt="Screen preview"
          width={1920}
          height={1080}
          className="w-full h-auto select-none"
          draggable={false}
        />

        {/* Existing hotspots */}
        {imageRef.current &&
          hotspots.map((hotspot) => (
            <div
              key={hotspot.id}
              className="absolute border-2 border-blue-500 bg-blue-500/20"
              style={{
                left: `${hotspot.xPercent * 100}%`,
                top: `${hotspot.yPercent * 100}%`,
                width: `${hotspot.widthPercent * 100}%`,
                height: `${hotspot.heightPercent * 100}%`,
              }}
            >
              <button
                onClick={() => handleDelete(hotspot.id)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full text-xs hover:bg-red-700"
              >
                ×
              </button>
            </div>
          ))}

        {/* Current drawing rectangle */}
        {currentRect && (
          <div
            className="absolute border-2 border-green-500 bg-green-500/20"
            style={{
              left: currentRect.x,
              top: currentRect.y,
              width: currentRect.width,
              height: currentRect.height,
            }}
          />
        )}
      </div>

      <div className="text-sm text-gray-600">
        Hotspots: {hotspots.length}
        {loading && <span className="ml-2">Saving...</span>}
      </div>
    </div>
  );
}
