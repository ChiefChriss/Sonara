import React, { useRef, useState, useCallback, useEffect } from 'react';
import useDawStore from '../state/dawStore';
import { AutomationPoint } from '../models/types';

const LANE_HEIGHT = 60;

interface AutomationLaneProps {
  trackId: number;
}

const AutomationLane: React.FC<AutomationLaneProps> = ({ trackId }) => {
  const track = useDawStore((s) => s.tracks.find((t) => t.id === trackId));
  const zoom = useDawStore((s) => s.zoom);
  const bpm = useDawStore((s) => s.bpm);
  const addAutomationPoint = useDawStore((s) => s.addAutomationPoint);
  const setVolumeAutomation = useDawStore((s) => s.setVolumeAutomation);
  const pushUndoSnapshot = useDawStore((s) => s.pushUndoSnapshot);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const pixelsPerBeat = 50 * zoom;
  const TOTAL_BARS = 50;
  const beatsPerBar = 4;
  const totalWidth = TOTAL_BARS * beatsPerBar * pixelsPerBeat;

  if (!track) return null;

  const points = track.volumeAutomation || [];

  // ─── Drawing ───

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#151528';
    ctx.fillRect(0, 0, w, h);

    // Grid lines (every bar)
    ctx.strokeStyle = '#1e1e38';
    ctx.lineWidth = 1;
    for (let i = 0; i <= TOTAL_BARS; i++) {
      const x = i * beatsPerBar * pixelsPerBeat;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // 50% horizontal guide
    ctx.strokeStyle = '#252542';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Build the full point list (including implicit start/end)
    const allPoints: AutomationPoint[] = [];
    if (points.length === 0) {
      // No automation — flat line at 100%
      allPoints.push({ beat: 0, value: 100 }, { beat: TOTAL_BARS * beatsPerBar, value: 100 });
    } else {
      // Add implicit start if first point isn't at beat 0
      if (points[0].beat > 0) {
        allPoints.push({ beat: 0, value: points[0].value });
      }
      allPoints.push(...points);
      // Extend to end
      const last = points[points.length - 1];
      allPoints.push({ beat: TOTAL_BARS * beatsPerBar, value: last.value });
    }

    // Draw fill
    ctx.beginPath();
    ctx.moveTo(allPoints[0].beat * pixelsPerBeat, h);
    allPoints.forEach((p) => {
      const x = p.beat * pixelsPerBeat;
      const y = h - (p.value / 100) * h;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(allPoints[allPoints.length - 1].beat * pixelsPerBeat, h);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(0, 212, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 212, 255, 0.02)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    allPoints.forEach((p, i) => {
      const x = p.beat * pixelsPerBeat;
      const y = h - (p.value / 100) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw points (only the real user-created ones)
    points.forEach((p, i) => {
      const x = p.beat * pixelsPerBeat;
      const y = h - (p.value / 100) * h;
      const isHovered = hoverIndex === i;
      const isDragging = dragIndex === i;

      ctx.beginPath();
      ctx.arc(x, y, isHovered || isDragging ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isDragging ? '#fff' : isHovered ? '#66e0ff' : '#00d4ff';
      ctx.fill();
      ctx.strokeStyle = '#0a0a1e';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [points, pixelsPerBeat, hoverIndex, dragIndex]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Also redraw on canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = totalWidth;
      canvas.height = LANE_HEIGHT;
      draw();
    }
  }, [totalWidth, draw]);

  // ─── Interaction ───

  const getPointAt = (x: number, y: number): number | null => {
    const h = LANE_HEIGHT;
    for (let i = 0; i < points.length; i++) {
      const px = points[i].beat * pixelsPerBeat;
      const py = h - (points[i].value / 100) * h;
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (dist < 10) return i;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hitIdx = getPointAt(x, y);

    if (hitIdx !== null) {
      // Start dragging existing point
      pushUndoSnapshot('Move Automation Point');
      setDragIndex(hitIdx);
    } else {
      // Add new point
      pushUndoSnapshot('Add Automation Point');
      const beat = Math.max(0, x / pixelsPerBeat);
      const value = Math.max(0, Math.min(100, ((LANE_HEIGHT - y) / LANE_HEIGHT) * 100));
      const snappedBeat = Math.round(beat * 4) / 4;
      addAutomationPoint(trackId, { beat: snappedBeat, value: Math.round(value) });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragIndex !== null) {
      // Drag point
      const beat = Math.max(0, x / pixelsPerBeat);
      const value = Math.max(0, Math.min(100, ((LANE_HEIGHT - y) / LANE_HEIGHT) * 100));
      const snappedBeat = Math.round(beat * 4) / 4;
      const newPoints = [...points];
      newPoints[dragIndex] = { beat: snappedBeat, value: Math.round(value) };
      newPoints.sort((a, b) => a.beat - b.beat);
      // Find where our point ended up after sort
      const newIdx = newPoints.findIndex(
        (p) => p.beat === snappedBeat && p.value === Math.round(value)
      );
      setDragIndex(newIdx >= 0 ? newIdx : dragIndex);
      setVolumeAutomation(trackId, newPoints);
    } else {
      setHoverIndex(getPointAt(x, y));
    }
  };

  const handleMouseUp = () => {
    setDragIndex(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hitIdx = getPointAt(x, y);
    if (hitIdx !== null) {
      pushUndoSnapshot('Delete Automation Point');
      const newPoints = points.filter((_, i) => i !== hitIdx);
      setVolumeAutomation(trackId, newPoints);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={totalWidth}
      height={LANE_HEIGHT}
      style={styles.canvas}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setDragIndex(null); setHoverIndex(null); }}
      onDoubleClick={handleDoubleClick}
    />
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  canvas: {
    display: 'block',
    cursor: 'crosshair',
  },
};

export default AutomationLane;