import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

type Tool = "pen" | "erase" | "line";

type WhiteboardHandle = {
  clear: () => void;
  getDataUrl: () => string | null;
  hasDrawing: () => boolean;
};

type WhiteboardProps = {
  className?: string;
};

type Point = { x: number; y: number };

type Size = { width: number; height: number };

const COLORS = ["#0b1420", "#2563ff", "#16a34a", "#f97316", "#dc2626", "#8b5cf6"];

const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(({ className }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const lineStartRef = useRef<Point | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(3);
  const [canvasSize, setCanvasSize] = useState<Size>({ width: 520, height: 260 });

  const dpr = useMemo(() => window.devicePixelRatio || 1, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.max(320, Math.floor(entry.contentRect.width));
      const height = Math.max(220, Math.floor(entry.contentRect.height));
      setCanvasSize({ width, height });
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.floor(canvasSize.width * dpr);
    canvas.height = Math.floor(canvasSize.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [canvasSize, dpr]);

  useImperativeHandle(ref, () => ({
    clear: clearCanvas,
    getDataUrl: () => {
      const canvas = canvasRef.current;
      if (!canvas || !dirty) return null;
      return canvas.toDataURL("image/png");
    },
    hasDrawing: () => dirty
  }));

  const getPoint = (event: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const configureContext = (ctx: CanvasRenderingContext2D) => {
    ctx.lineWidth = size;
    if (tool === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(event.nativeEvent);
    if (!point) return;
    drawingRef.current = true;
    lastPointRef.current = point;
    lineStartRef.current = point;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(event.nativeEvent);
    const last = lastPointRef.current;
    if (!point || !last) return;

    if (tool !== "line") {
      configureContext(ctx);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    lastPointRef.current = point;
    if (!dirty) setDirty(true);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;

    if (tool === "line") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const end = getPoint(event.nativeEvent);
      const start = lineStartRef.current;
      if (start && end) {
        configureContext(ctx);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        if (!dirty) setDirty(true);
      }
    }

    lastPointRef.current = null;
    lineStartRef.current = null;
  };

  return (
    <div className={`whiteboard ${className ?? ""}`} ref={containerRef}>
      <div className="whiteboard-tools">
        <div className="tool-group">
          <button
            className={tool === "pen" ? "active" : ""}
            onClick={() => setTool("pen")}
            type="button"
          >
            Pen
          </button>
          <button
            className={tool === "line" ? "active" : ""}
            onClick={() => setTool("line")}
            type="button"
          >
            Line
          </button>
          <button
            className={tool === "erase" ? "active" : ""}
            onClick={() => setTool("erase")}
            type="button"
          >
            Erase
          </button>
        </div>
        <div className="tool-group">
          {COLORS.map((swatch) => (
            <button
              key={swatch}
              className={`swatch ${color === swatch ? "active" : ""}`}
              style={{ backgroundColor: swatch }}
              onClick={() => {
                setColor(swatch);
                setTool("pen");
              }}
              type="button"
              aria-label="Select color"
            />
          ))}
        </div>
        <div className="tool-group">
          <label>
            Size
            <input
              type="range"
              min={2}
              max={10}
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
          </label>
          <button type="button" onClick={clearCanvas}>
            Clear
          </button>
        </div>
      </div>
      <div className="whiteboard-canvas">
        <canvas
          ref={canvasRef}
          style={{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!dirty && <div className="whiteboard-hint">Sketch an idea: graphs, arrays, trees.</div>}
      </div>
    </div>
  );
});

Whiteboard.displayName = "Whiteboard";

export type { WhiteboardHandle };
export default Whiteboard;
