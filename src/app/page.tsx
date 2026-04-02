'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  CreditCard, FileText, Smartphone, Laptop, Monitor, BookOpen, Package,
  ShoppingBag, Shirt, Image as ImageIcon, Coffee, Wine, Signpost,
  BookMarked, Layers, Disc3, RectangleHorizontal, Camera, ScanLine,
  Eye, ChevronDown, Sparkles, Sun, Palette, Copy,
  Check, Hand, Ratio, FileImage, RotateCcw, Infinity as InfinityIcon,
  Zap, Fingerprint, Pipette, ImagePlus, X, Plus, SlidersHorizontal,
  Bus, MapPin, Flag, PanelTop, UtensilsCrossed, Apple, Wand2,
  CircleDot, Hash, Save, Trash2, FolderOpen,
  Search, Menu, Braces, Mail, ArrowRight, ArrowLeft, ChevronRight,
  Layers2, Settings2, LayoutGrid,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  OBJECTS, CAMERAS, SURFACES, SETTINGS, LIGHTINGS, MATERIALS,
  IMAGE_RATIOS, ASSET_INPUTS, PROPS, HANDS, SCREEN_EFFECTS,
  IMPERFECTIONS_UNIVERSAL, IMPERFECTIONS_SCREEN, IMPERFECTIONS_FABRIC,
  IMPERFECTIONS_PRINT, IMPERFECTIONS_HARD,
  PRINT_OBJECTS, FABRIC_OBJECTS, SCREEN_OBJECTS, SIGNAGE_OBJECTS,
  OBJECT_OPTIONS, getObjectDefaults,
  MockupConfig, ObjectType, CameraAngle, SurfaceType, SettingType,
  LightingType, MaterialType, ImageRatio, AssetInputType, PropType,
  HandMode, ScreenEffectType, ImperfectionType, CustomAngle,
} from '@/types/mockup';
import { generateMockupPrompt } from '@/lib/prompt-engine';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── System font stack ─────────────────────────────────────────────────────────

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

// ── Object icon map ────────────────────────────────────────────────────────

const OBJECT_ICONS: Record<string, React.ElementType> = {
  'business-cards': CreditCard, 'letterhead': FileText, 'phone-screen': Smartphone,
  'laptop-screen': Laptop, 'book-magazine': BookOpen, 'product-box': Package,
  'shopping-bag': ShoppingBag, 'tshirt': Shirt, 'tote-bag': ShoppingBag,
  'poster-print': ImageIcon, 'coffee-mug': Coffee, 'bottle-label': Wine,
  'signage': Signpost, 'notebook': BookMarked, 'brand-identity': Layers,
  'vinyl-cd': Disc3, 'billboard': RectangleHorizontal,
  'desktop-monitor': Monitor, 'imac': Apple,
  'restaurant-menu': UtensilsCrossed, 'bus-ad': Bus, 'bus-stop': MapPin,
  'flag': Flag, 'pull-up-banner': PanelTop,
  'postcard': FileImage, 'tablet-apple': Apple, 'tablet-android': Smartphone,
  'newspaper': FileText, 'magazine-ad': BookOpen,
  'exhibition-stand': Signpost, 'tri-fold-flyer': FileText, 'envelope': Mail,
};

// ── Object categories ──────────────────────────────────────────────────────

const HARD_OBJECTS: ObjectType[] = ['coffee-mug', 'bottle-label'];

const OBJECT_CATEGORIES = [
  { id: 'all', label: 'All', objects: OBJECTS.map(o => o.id) },
  { id: 'print', label: 'Print', objects: PRINT_OBJECTS },
  { id: 'screen', label: 'Screen', objects: SCREEN_OBJECTS },
  { id: 'fabric', label: 'Fabric', objects: FABRIC_OBJECTS },
  { id: 'signage', label: 'Signage', objects: SIGNAGE_OBJECTS },
  { id: 'hard', label: 'Hard', objects: HARD_OBJECTS },
] as const;

// ── 3D Math helpers ─────────────────────────────────────────────────────────

function rotatePoint3D(x: number, y: number, z: number, pitchDeg: number, yawDeg: number) {
  const p = (pitchDeg * Math.PI) / 180;
  const yw = (yawDeg * Math.PI) / 180;
  const x1 = x * Math.cos(yw) + z * Math.sin(yw);
  const z1 = -x * Math.sin(yw) + z * Math.cos(yw);
  const y1 = y * Math.cos(p) - z1 * Math.sin(p);
  const z2 = y * Math.sin(p) + z1 * Math.cos(p);
  return { x: x1, y: y1, z: z2 };
}

function generateRingPoints(axis: 'x' | 'y' | 'z', radius: number, segments: number, pitchDeg: number, yawDeg: number) {
  const points: { x: number; y: number; z: number; sx: number; sy: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    let px = 0, py = 0, pz = 0;
    if (axis === 'x') { py = Math.cos(t) * radius; pz = Math.sin(t) * radius; }
    if (axis === 'y') { px = Math.cos(t) * radius; pz = Math.sin(t) * radius; }
    if (axis === 'z') { px = Math.cos(t) * radius; py = Math.sin(t) * radius; }
    const r = rotatePoint3D(px, py, pz, pitchDeg, yawDeg);
    points.push({ ...r, sx: r.x, sy: -r.y });
  }
  return points;
}

function distToPolyline(mx: number, my: number, points: { sx: number; sy: number }[], cx: number, cy: number): number {
  let minDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const ax = cx + points[i].sx, ay = cy + points[i].sy;
    const bx = cx + points[i + 1].sx, by = cy + points[i + 1].sy;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) { minDist = Math.min(minDist, Math.hypot(mx - ax, my - ay)); continue; }
    const t = Math.max(0, Math.min(1, ((mx - ax) * dx + (my - ay) * dy) / len2));
    const projX = ax + t * dx, projY = ay + t * dy;
    minDist = Math.min(minDist, Math.hypot(mx - projX, my - projY));
  }
  return minDist;
}

// ── 3D Angle Gizmo ─────────────────────────────────────────────────────────

type DragAxis = 'x' | 'y' | 'z' | 'trackball' | null;

function AngleWidget({ angle, onChange }: { angle: CustomAngle; onChange: (a: CustomAngle) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<DragAxis>(null);
  const dragState = useRef<{ active: boolean; axis: DragAxis; lastX: number; lastY: number }>({
    active: false, axis: null, lastX: 0, lastY: 0,
  });

  const SIZE = 200;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const RADIUS = 70;
  const SEGMENTS = 64;
  const HIT_THRESHOLD = 12;

  const xRing = useMemo(() => generateRingPoints('x', RADIUS, SEGMENTS, angle.pitch, angle.yaw), [angle.pitch, angle.yaw]);
  const yRing = useMemo(() => generateRingPoints('y', RADIUS, SEGMENTS, angle.pitch, angle.yaw), [angle.pitch, angle.yaw]);
  const zRing = useMemo(() => generateRingPoints('z', RADIUS, SEGMENTS, angle.pitch, angle.yaw), [angle.pitch, angle.yaw]);

  const getSvgCoords = useCallback((e: React.PointerEvent | PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
    };
  }, []);

  const detectAxis = useCallback((mx: number, my: number): DragAxis => {
    const distX = distToPolyline(mx, my, xRing, CX, CY);
    const distY = distToPolyline(mx, my, yRing, CX, CY);
    const distZ = distToPolyline(mx, my, zRing, CX, CY);
    const distCenter = Math.hypot(mx - CX, my - CY);
    const distTrackball = Math.abs(distCenter - RADIUS - 8);
    const minRing = Math.min(distX, distY, distZ);
    if (minRing < HIT_THRESHOLD) {
      if (distX === minRing) return 'x';
      if (distY === minRing) return 'y';
      return 'z';
    }
    if (distTrackball < HIT_THRESHOLD) return 'trackball';
    if (distCenter < RADIUS + 20) return 'trackball';
    return null;
  }, [xRing, yRing, zRing]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const { x, y } = getSvgCoords(e);
    const axis = detectAxis(x, y);
    if (!axis) return;
    dragState.current = { active: true, axis, lastX: e.clientX, lastY: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [getSvgCoords, detectAxis]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.active) {
      const { x, y } = getSvgCoords(e);
      setHovered(detectAxis(x, y));
      return;
    }
    const dx = e.clientX - dragState.current.lastX;
    const dy = e.clientY - dragState.current.lastY;
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
    const sensitivity = 0.6;
    const axis = dragState.current.axis;
    let newPitch = angle.pitch;
    let newYaw = angle.yaw;
    if (axis === 'x') newPitch = angle.pitch + dy * sensitivity;
    else if (axis === 'y') newYaw = angle.yaw + dx * sensitivity;
    else { newPitch = angle.pitch + dy * sensitivity; newYaw = angle.yaw + dx * sensitivity; }
    onChange({
      pitch: Math.max(-90, Math.min(90, newPitch)),
      yaw: Math.max(-180, Math.min(180, newYaw)),
    });
  }, [angle, onChange, getSvgCoords, detectAxis]);

  const handlePointerUp = useCallback(() => { dragState.current.active = false; }, []);
  const handlePointerLeave = useCallback(() => { if (!dragState.current.active) setHovered(null); }, []);

  const pitchLabel = angle.pitch > 5 ? 'Above' : angle.pitch < -5 ? 'Below' : 'Level';
  const yawLabel = Math.abs(angle.yaw) < 10 ? 'Front' : angle.yaw > 0 ? 'Right' : 'Left';

  const xEnd = rotatePoint3D(RADIUS + 12, 0, 0, angle.pitch, angle.yaw);
  const yEnd = rotatePoint3D(0, RADIUS + 12, 0, angle.pitch, angle.yaw);
  const zEnd = rotatePoint3D(0, 0, RADIUS + 12, angle.pitch, angle.yaw);

  const SLAB_W = 42, SLAB_H = 30, SLAB_D = 5;
  const slabVerts = [
    { x: -SLAB_W/2, y: -SLAB_H/2, z: -SLAB_D/2 },
    { x:  SLAB_W/2, y: -SLAB_H/2, z: -SLAB_D/2 },
    { x:  SLAB_W/2, y:  SLAB_H/2, z: -SLAB_D/2 },
    { x: -SLAB_W/2, y:  SLAB_H/2, z: -SLAB_D/2 },
    { x: -SLAB_W/2, y: -SLAB_H/2, z:  SLAB_D/2 },
    { x:  SLAB_W/2, y: -SLAB_H/2, z:  SLAB_D/2 },
    { x:  SLAB_W/2, y:  SLAB_H/2, z:  SLAB_D/2 },
    { x: -SLAB_W/2, y:  SLAB_H/2, z:  SLAB_D/2 },
  ].map(v => {
    const r = rotatePoint3D(v.x, v.y, v.z, angle.pitch, angle.yaw);
    return { ...r, sx: CX + r.x, sy: CY - r.y };
  });

  const slabFaces = [
    { verts: [0, 1, 2, 3], nz: -1, color: '#2A2520', label: '',      isFront: false },
    { verts: [5, 4, 7, 6], nz:  1, color: '#D4A843', label: 'front', isFront: true },
    { verts: [4, 0, 3, 7], nz:  0, color: '#3D332A', label: '',      isFront: false },
    { verts: [1, 5, 6, 2], nz:  0, color: '#3D332A', label: '',      isFront: false },
    { verts: [4, 5, 1, 0], nz:  0, color: '#4A3E33', label: '',      isFront: false },
    { verts: [3, 2, 6, 7], nz:  0, color: '#2A2520', label: '',      isFront: false },
  ].map(face => {
    const pts = face.verts.map(i => slabVerts[i]);
    const ax = pts[1].x - pts[0].x, ay = pts[1].y - pts[0].y;
    const bx = pts[2].x - pts[0].x, by = pts[2].y - pts[0].y;
    const nz = ax * by - ay * bx;
    return { ...face, pts, visible: nz < 0, avgZ: pts.reduce((s, p) => s + p.z, 0) / 4 };
  }).filter(f => f.visible).sort((a, b) => b.avgZ - a.avgZ);

  const avgZ = (ring: { z: number }[]) => ring.reduce((s, p) => s + p.z, 0) / ring.length;
  const rings: { axis: DragAxis; points: typeof xRing; color: string; hoverColor: string; label: string; end: typeof xEnd }[] = [
    { axis: 'x', points: xRing, color: '#E05555', hoverColor: '#FF6666', label: 'X', end: xEnd },
    { axis: 'y', points: yRing, color: '#55B855', hoverColor: '#66DD66', label: 'Y', end: yEnd },
    { axis: 'z', points: zRing, color: '#5577EE', hoverColor: '#6688FF', label: 'Z', end: zEnd },
  ];
  rings.sort((a, b) => avgZ(a.points) - avgZ(b.points));

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border border-[--border-light] overflow-hidden select-none bg-[--bg-inset]"
        style={{ cursor: hovered ? 'grab' : 'default' }}>
        <svg ref={svgRef} viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp} onPointerLeave={handlePointerLeave}>
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2A2725" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={SIZE} height={SIZE} fill="url(#grid)" opacity="0.4" />
          <circle cx={CX} cy={CY} r={RADIUS + 8}
            fill="none" stroke={hovered === 'trackball' ? '#555' : '#333'}
            strokeWidth={hovered === 'trackball' ? 2.5 : 1.5}
            strokeDasharray="4 3" opacity={hovered === 'trackball' ? 0.9 : 0.4} />
          <line x1={CX - 6} y1={CY} x2={CX + 6} y2={CY} stroke="#444" strokeWidth="0.5" />
          <line x1={CX} y1={CY - 6} x2={CX} y2={CY + 6} stroke="#444" strokeWidth="0.5" />
          {slabFaces.map((face, i) => {
            const d = face.pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ') + ' Z';
            const cx = face.pts.reduce((s, p) => s + p.sx, 0) / 4;
            const cy = face.pts.reduce((s, p) => s + p.sy, 0) / 4;
            return (
              <g key={`face-${i}`}>
                <path d={d} fill={face.color} stroke="#5A4A38" strokeWidth="0.5" opacity={0.9} />
                {face.isFront && (
                  <>
                    <path d={(() => {
                      const inset = 0.15;
                      return face.pts.map((p, j) => {
                        const nx = cx + (p.sx - cx) * (1 - inset);
                        const ny = cy + (p.sy - cy) * (1 - inset);
                        return `${j === 0 ? 'M' : 'L'}${nx.toFixed(1)},${ny.toFixed(1)}`;
                      }).join(' ') + ' Z';
                    })()} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                    <circle cx={cx} cy={cy} r={2} fill="white" opacity={0.4} />
                    <text x={cx} y={cy + 6} textAnchor="middle" dominantBaseline="central"
                      fill="white" fontSize="7" fontWeight="bold" fontFamily="monospace" opacity={0.5}>FRONT</text>
                  </>
                )}
              </g>
            );
          })}
          {rings.map(({ axis, points, color, hoverColor, label: axLabel, end }) => {
            const isActive = hovered === axis || (dragState.current.active && dragState.current.axis === axis);
            const c = isActive ? hoverColor : color;
            const frontPath: string[] = [];
            const backPath: string[] = [];
            for (let i = 0; i < points.length - 1; i++) {
              const p1 = points[i], p2 = points[i + 1];
              const seg = `M${CX + p1.sx},${CY + p1.sy} L${CX + p2.sx},${CY + p2.sy}`;
              if (p1.z + p2.z > 0) backPath.push(seg); else frontPath.push(seg);
            }
            return (
              <g key={axis}>
                <path d={backPath.join(' ')} fill="none" stroke={c} strokeWidth={isActive ? 2.5 : 1.5} opacity={0.2} strokeLinecap="round" />
                <path d={frontPath.join(' ')} fill="none" stroke={c} strokeWidth={isActive ? 3 : 2} opacity={isActive ? 1 : 0.6} strokeLinecap="round" />
                <circle cx={CX + end.x} cy={CY - end.y} r={isActive ? 9 : 7} fill={c} opacity={isActive ? 0.9 : 0.4} />
                <text x={CX + end.x} y={CY - end.y + 1} textAnchor="middle" dominantBaseline="central"
                  fill="white" fontSize="8" fontWeight="bold" fontFamily="monospace">{axLabel}</text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={2.5} fill="#666" />
          <text x={12} y={SIZE - 8} fill="#555" fontSize="8" fontFamily="monospace">
            <tspan fill="#E05555">X</tspan>=Pitch <tspan fill="#55B855">Y</tspan>=Yaw <tspan fill="#5577EE">Z</tspan>=Free
          </text>
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[--bg-inset] rounded-lg px-3 py-2 border border-[--border]">
          <span className="text-[11px] font-bold text-[#E05555] uppercase block">Pitch (X)</span>
          <span className="text-[13px] font-mono font-bold text-[--foreground]">{Math.round(angle.pitch)}° <span className="text-[--foreground-dim] text-[11px]">{pitchLabel}</span></span>
        </div>
        <div className="bg-[--bg-inset] rounded-lg px-3 py-2 border border-[--border]">
          <span className="text-[11px] font-bold text-[#55B855] uppercase block">Yaw (Y)</span>
          <span className="text-[13px] font-mono font-bold text-[--foreground]">{Math.round(angle.yaw)}° <span className="text-[--foreground-dim] text-[11px]">{yawLabel}</span></span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Top', p: 80, y: 0 },
          { label: 'Front', p: 0, y: 0 },
          { label: '3/4', p: 30, y: 35 },
          { label: 'Low', p: -25, y: 15 },
        ].map(pre => (
          <button key={pre.label}
            onClick={() => onChange({ pitch: pre.p, yaw: pre.y })}
            className="text-[11px] font-bold text-[--foreground-muted] hover:text-[--accent] hover:bg-[--accent-subtle] transition-colors py-1.5 rounded-md border border-[--border] bg-[--bg-surface]">
            {pre.label}
          </button>
        ))}
      </div>
      <button onClick={() => onChange({ pitch: 30, yaw: 30 })}
        className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold text-[--foreground-dim] hover:text-[--accent] transition-colors py-1">
        <RotateCcw size={10} /> Reset
      </button>
    </div>
  );
}

// ── Option pill ────────────────────────────────────────────────────────────

function TogglePill({ label, active, onClick, icon: Icon }: {
  label: string; active: boolean; onClick: () => void; icon?: React.ElementType;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "px-3 py-2 rounded-lg border text-[13px] font-medium transition-all duration-150 flex items-center gap-1.5",
        active
          ? "border-[--accent] bg-[--accent-subtle] text-[--accent] ring-1 ring-[--accent]/30"
          : "border-[--border] hover:border-[--border-accent] bg-[--bg-surface] text-[--foreground-muted] hover:text-[--foreground]"
      )}>
      {Icon && <Icon size={12} strokeWidth={2} />}
      {label}
    </button>
  );
}

// ── Color extraction ───────────────────────────────────────────────────────

function extractColorsFromImage(file: File, count: number): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 150;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const pixels: [number, number, number][] = [];
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue;
        const brightness = (r + g + b) / 3;
        if (brightness < 15 || brightness > 240) continue;
        pixels.push([r, g, b]);
      }
      if (pixels.length === 0) { resolve([]); return; }
      const medianCut = (bucket: [number, number, number][], depth: number): [number, number, number][][] => {
        if (depth === 0 || bucket.length === 0) return [bucket];
        let maxRange = 0, splitCh = 0;
        for (let ch = 0; ch < 3; ch++) {
          const vals = bucket.map(p => p[ch]);
          const range = Math.max(...vals) - Math.min(...vals);
          if (range > maxRange) { maxRange = range; splitCh = ch; }
        }
        bucket.sort((a, b) => a[splitCh] - b[splitCh]);
        const mid = Math.floor(bucket.length / 2);
        return [...medianCut(bucket.slice(0, mid), depth - 1), ...medianCut(bucket.slice(mid), depth - 1)];
      };
      const depth = Math.ceil(Math.log2(Math.max(count, 2)));
      const buckets = medianCut(pixels, depth);
      const colors = buckets
        .filter(b => b.length > 0)
        .map(bucket => {
          const avg = [0, 0, 0];
          for (const p of bucket) { avg[0] += p[0]; avg[1] += p[1]; avg[2] += p[2]; }
          return avg.map(v => Math.round(v / bucket.length)) as [number, number, number];
        })
        .sort((a, b) => {
          const hue = (r: number, g: number, bl: number) => Math.atan2(Math.sqrt(3) * (g - bl), 2 * r - g - bl);
          return hue(...a) - hue(...b);
        })
        .slice(0, count)
        .map(([r, g, b]) => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
      resolve(colors);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}

// ── Section definitions ────────────────────────────────────────────────────

type SectionId = 'ratio' | 'object' | 'object-details' | 'asset-input' | 'camera' | 'surface' | 'setting' | 'lighting' | 'colors' | 'props' | 'hand' | 'screen-fx' | 'imperfections' | 'infinite-bg' | 'brand';

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'ratio', label: 'Image Ratio', icon: Ratio },
  { id: 'object', label: 'Object', icon: Package },
  { id: 'object-details', label: 'Object Details', icon: SlidersHorizontal },
  { id: 'asset-input', label: 'Asset Input', icon: FileImage },
  { id: 'camera', label: 'Camera Angle', icon: Camera },
  { id: 'surface', label: 'Surface', icon: ScanLine },
  { id: 'setting', label: 'Setting', icon: Sun },
  { id: 'lighting', label: 'Lighting', icon: Eye },
  { id: 'colors', label: 'Colors', icon: Pipette },
  { id: 'props', label: 'Props', icon: Coffee },
  { id: 'hand', label: 'Hand', icon: Hand },
  { id: 'screen-fx', label: 'Screen Effects', icon: Zap },
  { id: 'imperfections', label: 'Imperfections', icon: Fingerprint },
  { id: 'infinite-bg', label: 'Infinite Background', icon: InfinityIcon },
  { id: 'brand', label: 'Brand Details', icon: Palette },
];

// ── Prompt quality score ───────────────────────────────────────────────────

function getPromptCompleteness(config: MockupConfig): { score: number; label: string } {
  let filled = 3;
  const total = 10;
  if (config.assetDescription) filled++;
  if (config.swatchColors.length > 0) filled++;
  if (config.props.length > 0) filled++;
  if (config.hand !== 'none') filled++;
  if (config.imperfections.length > 0) filled++;
  if (config.colorPalette) filled++;
  if (config.screenEffects.length > 0 && SCREEN_OBJECTS.includes(config.object)) filled++;
  const score = Math.min(Math.round((filled / total) * 100), 100);
  const label = score < 40 ? 'Basic' : score < 70 ? 'Good' : score < 90 ? 'Detailed' : 'Expert';
  return { score, label };
}

// ── Aspect ratio map for visual preview ────────────────────────────────────

const RATIO_DIMENSIONS: Record<string, { w: number; h: number }> = {
  '1:1': { w: 1, h: 1 }, '4:5': { w: 4, h: 5 }, '4:3': { w: 4, h: 3 },
  '3:2': { w: 3, h: 2 }, '16:9': { w: 16, h: 9 }, '21:9': { w: 21, h: 9 },
  '9:16': { w: 9, h: 16 }, '2:3': { w: 2, h: 3 },
};

// ── Default config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: MockupConfig = {
  object: 'business-cards',
  objectDetails: getObjectDefaults('business-cards'),
  camera: 'three-quarter',
  customAngle: null,
  surface: 'white-marble',
  setting: 'white-studio',
  lighting: 'window-pane',
  intensity: 65,
  material: 'matte',
  assetDescription: '',
  colorPalette: 'Warm neutrals, off-whites, and soft grays',
  swatchColors: [],
  imageRatio: '4:3',
  assetInput: 'transparent-logo',
  assetDimensions: '',
  props: [],
  hand: 'none',
  screenEffects: [],
  imperfections: [],
  infiniteBackground: false,
  infiniteBgColor: '#ffffff',
};

// ── Section "modified" detection ───────────────────────────────────────────

function getSectionModified(sectionId: SectionId, config: MockupConfig): boolean {
  switch (sectionId) {
    case 'ratio':         return config.imageRatio !== DEFAULT_CONFIG.imageRatio;
    case 'object':        return config.object !== DEFAULT_CONFIG.object;
    case 'object-details': {
      const defs = OBJECT_OPTIONS[config.object] ?? [];
      return defs.some(d => (config.objectDetails[d.key] ?? d.default) !== d.default);
    }
    case 'asset-input':   return config.assetInput !== DEFAULT_CONFIG.assetInput || !!config.assetDimensions;
    case 'camera':        return config.camera !== DEFAULT_CONFIG.camera;
    case 'surface':       return config.surface !== DEFAULT_CONFIG.surface;
    case 'setting':       return config.setting !== DEFAULT_CONFIG.setting;
    case 'lighting':      return config.lighting !== DEFAULT_CONFIG.lighting || config.intensity !== DEFAULT_CONFIG.intensity;
    case 'colors':        return config.swatchColors.length > 0;
    case 'props':         return config.props.length > 0;
    case 'hand':          return config.hand !== DEFAULT_CONFIG.hand;
    case 'screen-fx':     return config.screenEffects.length > 0;
    case 'imperfections': return config.imperfections.length > 0;
    case 'infinite-bg':   return config.infiniteBackground !== DEFAULT_CONFIG.infiniteBackground;
    case 'brand':         return !!config.assetDescription || config.material !== DEFAULT_CONFIG.material || config.colorPalette !== DEFAULT_CONFIG.colorPalette;
    default:              return false;
  }
}

// ── Preset system ──────────────────────────────────────────────────────────

interface SavedPreset {
  name: string;
  config: MockupConfig;
  createdAt: number;
}

const PRESETS_STORAGE_KEY = 'nb-presets';
const UI_MODE_KEY = 'nb-ui-mode';

function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function savePresetsToStorage(presets: SavedPreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage full or disabled — silently degrade
  }
}

// ── Built-in presets ───────────────────────────────────────────────────────

const BUILT_IN_PRESETS: SavedPreset[] = [
  { name: 'Business Card Flat Lay', config: { ...DEFAULT_CONFIG, object: 'business-cards', camera: 'top-down', surface: 'white-marble', setting: 'white-studio', lighting: 'clean-studio', material: 'matte', props: ['pen-pencil', 'plant'] }, createdAt: 0 },
  { name: 'Phone App Showcase', config: { ...DEFAULT_CONFIG, object: 'phone-screen', camera: 'three-quarter', surface: 'dark-slate', setting: 'dark-studio', lighting: 'spotlight', hand: 'holding' }, createdAt: 0 },
  { name: 'Brand Identity Spread', config: { ...DEFAULT_CONFIG, object: 'brand-identity', camera: 'top-down', surface: 'light-oak', setting: 'sunlit-natural', lighting: 'golden-hour', props: ['coffee-cup', 'pen-pencil', 'glasses'] }, createdAt: 0 },
  { name: 'Laptop Website Hero', config: { ...DEFAULT_CONFIG, object: 'laptop-screen', camera: 'three-quarter', surface: 'dark-walnut', setting: 'office-desk', lighting: 'window-pane' }, createdAt: 0 },
  { name: 'Magazine Cover Editorial', config: { ...DEFAULT_CONFIG, object: 'magazine-ad', camera: 'three-quarter', surface: 'linen-fabric', setting: 'sunlit-natural', lighting: 'golden-hour' }, createdAt: 0 },
  { name: 'Product Box Unboxing', config: { ...DEFAULT_CONFIG, object: 'product-box', camera: 'low-angle', surface: 'white-marble', setting: 'white-studio', lighting: 'clean-studio' }, createdAt: 0 },
  { name: 'T-Shirt Lifestyle', config: { ...DEFAULT_CONFIG, object: 'tshirt', camera: 'eye-level', surface: 'concrete', setting: 'urban', lighting: 'golden-hour' }, createdAt: 0 },
  { name: 'Poster Gallery Wall', config: { ...DEFAULT_CONFIG, object: 'poster-print', camera: 'eye-level', surface: 'white-marble', setting: 'white-studio', lighting: 'spotlight', imageRatio: '2:3' }, createdAt: 0 },
  { name: 'Coffee Mug Morning', config: { ...DEFAULT_CONFIG, object: 'coffee-mug', camera: 'three-quarter', surface: 'light-oak', setting: 'cafe-table', lighting: 'golden-hour', props: ['book', 'plant'] }, createdAt: 0 },
  { name: 'Billboard Night Scene', config: { ...DEFAULT_CONFIG, object: 'billboard', camera: 'low-angle', surface: 'concrete', setting: 'urban', lighting: 'neon-glow', imageRatio: '16:9' }, createdAt: 0 },
  { name: 'Envelope & Letterhead', config: { ...DEFAULT_CONFIG, object: 'envelope', camera: 'top-down', surface: 'white-marble', setting: 'white-studio', lighting: 'clean-studio', material: 'linen' }, createdAt: 0 },
  { name: 'Exhibition Stand Event', config: { ...DEFAULT_CONFIG, object: 'exhibition-stand', camera: 'three-quarter', surface: 'concrete', setting: 'urban', lighting: 'clean-studio', imageRatio: '16:9' }, createdAt: 0 },
];

// ── Structured prompt segments ─────────────────────────────────────────────

function getPromptSegments(config: MockupConfig): { label: string; text: string }[] {
  const segments: { label: string; text: string }[] = [];
  const fullPrompt = generateMockupPrompt(config);

  const parts = fullPrompt.split('. ').filter(s => s.trim().length > 0);

  const grouped: { label: string; texts: string[] }[] = [
    { label: 'Style', texts: [] },
    { label: 'Ratio', texts: [] },
    { label: 'Object', texts: [] },
    { label: 'Camera', texts: [] },
    { label: 'Environment', texts: [] },
    { label: 'Lighting', texts: [] },
    { label: 'Material & Asset', texts: [] },
    { label: 'Details', texts: [] },
    { label: 'Colors', texts: [] },
    { label: 'Render', texts: [] },
  ];

  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes('Hasselblad') || p.includes('megapixels') || p.includes('editorial lighting')) {
      grouped[0].texts.push(p);
    } else if (p.includes('aspect ratio') || p.includes('portrait') || p.includes('landscape') || p.includes('Square 1:1') || p.includes('Ultra-wide') || p.includes('Vertical 9:16') || p.includes('Classic 4:3') || p.includes('Standard 3:2') || p.includes('Tall 2:3') || p.includes('Cinematic wide')) {
      grouped[1].texts.push(p);
    } else if (p.includes('Shot from') || p.includes('Captured at') || p.includes('photographed from') || p.includes('Camera positioned') || p.includes('eye level') || p.includes('Extreme macro') || p.includes('isometric') || p.includes('Dutch tilt')) {
      grouped[3].texts.push(p);
    } else if (p.includes('floats on a seamless') || p.includes('The subject is') || p.includes('Set in') || p.includes('Set on') || p.includes('Set among') || p.includes('Set against')) {
      grouped[4].texts.push(p);
    } else if (p.startsWith('Lighting:') || p.includes('lighting') && p.includes('Shadow intensity')) {
      grouped[5].texts.push(p);
    } else if (p.startsWith('Material finish') || p.startsWith('The provided asset') || p.includes('dimensions:')) {
      grouped[6].texts.push(p);
    } else if (p.includes('hand') || p.includes('Hand') || p.includes('Screen effect') || p.includes('reflection') || p.includes('glare') || p.includes('light leak') || p.includes('prop') || p.startsWith('Subtle imperfection') || p.startsWith('Photographic imperfection') || p.includes('Wear and imperfection')) {
      grouped[7].texts.push(p);
    } else if (p.includes('Color palette') || p.includes('swatch') || p.includes('#') || p.includes('hex')) {
      grouped[8].texts.push(p);
    } else if (p.includes('Unreal Engine') || p.includes('8K') || p.includes('ray tracing') || p.includes('photorealistic render') || p.includes('photorealism')) {
      grouped[9].texts.push(p);
    } else {
      grouped[2].texts.push(p);
    }
  }

  for (const g of grouped) {
    if (g.texts.length > 0) {
      segments.push({ label: g.label, text: g.texts.join('. ').replace(/\.\s*\.$/, '.') + (g.texts.join('').endsWith('.') ? '' : '.') });
    }
  }

  return segments.filter(s => s.text.trim().length > 2);
}

// ── Wizard steps ───────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { id: 'presets',     title: 'Welcome back!',                subtitle: 'Start fresh or pick a preset to jump right in.',      icon: Sparkles },
  { id: 'object',      title: 'What are we making?',          subtitle: 'Choose the product you want to photograph.',           icon: Package },
  { id: 'details',     title: 'Customize the details.',       subtitle: 'Fine-tune options specific to your object.',           icon: SlidersHorizontal },
  { id: 'camera',      title: 'How should it look?',          subtitle: 'Pick a frame ratio and camera angle.',                 icon: Camera },
  { id: 'environment', title: 'Set the scene.',               subtitle: 'Choose a surface and setting for your shot.',          icon: Sun },
  { id: 'lighting',    title: 'Light it up.',                 subtitle: 'Pick a lighting mood and intensity.',                  icon: Eye },
  { id: 'style',       title: 'Define the look.',             subtitle: 'Colors, asset type, and brand description.',           icon: Palette },
  { id: 'extras',      title: 'Add some flair.',              subtitle: 'Optional props, hand, effects and imperfections.',     icon: Zap },
  { id: 'review',      title: 'Your prompt is ready.',        subtitle: 'Copy it and go create something beautiful.',           icon: Check },
] as const;

type WizardStepId = typeof WIZARD_STEPS[number]['id'];

// ── Main Component ─────────────────────────────────────────────────────────

export default function MockupGenerator() {
  const [config, setConfig] = useState<MockupConfig>(DEFAULT_CONFIG);
  const [uiMode, setUiMode] = useState<'wizard' | 'studio'>('wizard');
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardDirection, setWizardDirection] = useState<'forward' | 'back'>('forward');

  // Studio state
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set(['object']));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Shared state
  const [copied, setCopied] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [objectCategoryFilter, setObjectCategoryFilter] = useState('all');
  const [objectSearch, setObjectSearch] = useState('');
  const [copyFormat, setCopyFormat] = useState<'text' | 'json'>('text');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preset system
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [showPresetPanel, setShowPresetPanel] = useState(false);
  const [presetSaved, setPresetSaved] = useState(false);

  // Load presets + UI mode preference from localStorage on mount
  useEffect(() => { setPresets(loadPresets()); }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(UI_MODE_KEY) as 'wizard' | 'studio' | null;
      if (saved === 'wizard' || saved === 'studio') setUiMode(saved);
    } catch { /* ignore */ }
  }, []);

  // Save UI mode preference
  useEffect(() => {
    try { localStorage.setItem(UI_MODE_KEY, uiMode); } catch { /* ignore */ }
  }, [uiMode]);

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const newPreset: SavedPreset = { name, config, createdAt: Date.now() };
    const existing = presets.filter(p => p.name !== name);
    const updated = [newPreset, ...existing];
    setPresets(updated);
    savePresetsToStorage(updated);
    setPresetName('');
    setPresetSaved(true);
    setTimeout(() => setPresetSaved(false), 1500);
  };

  const loadPreset = (preset: SavedPreset) => {
    setConfig({ ...DEFAULT_CONFIG, ...preset.config });
    setShowPresetPanel(false);
  };

  const deletePreset = (name: string) => {
    const updated = presets.filter(p => p.name !== name);
    setPresets(updated);
    savePresetsToStorage(updated);
  };

  // Live prompt
  const generatedPrompt = useMemo(() => generateMockupPrompt(config), [config]);
  const completeness = useMemo(() => getPromptCompleteness(config), [config]);
  const wordCount = useMemo(() => generatedPrompt.split(/\s+/).length, [generatedPrompt]);
  const promptSegments = useMemo(() => getPromptSegments(config), [config]);

  // Studio: Auto-collapse sections
  const toggleSection = (id: SectionId) => {
    setOpenSections(prev => {
      if (prev.has(id)) return new Set<SectionId>();
      return new Set<SectionId>([id]);
    });
  };

  // Config helpers
  const toggleProp = (id: PropType) => {
    setConfig(prev => ({
      ...prev,
      props: prev.props.includes(id) ? prev.props.filter(p => p !== id) : [...prev.props, id],
    }));
  };

  const toggleScreenEffect = (id: ScreenEffectType) => {
    setConfig(prev => ({
      ...prev,
      screenEffects: prev.screenEffects.includes(id) ? prev.screenEffects.filter(e => e !== id) : [...prev.screenEffects, id],
    }));
  };

  const toggleImperfection = (id: ImperfectionType) => {
    setConfig(prev => ({
      ...prev,
      imperfections: prev.imperfections.includes(id) ? prev.imperfections.filter(i => i !== id) : [...prev.imperfections, id],
    }));
  };

  const availableImperfections = [
    ...IMPERFECTIONS_UNIVERSAL,
    ...(SCREEN_OBJECTS.includes(config.object) ? IMPERFECTIONS_SCREEN : []),
    ...(FABRIC_OBJECTS.includes(config.object) ? IMPERFECTIONS_FABRIC : []),
    ...(PRINT_OBJECTS.includes(config.object) ? IMPERFECTIONS_PRINT : []),
    ...((!SCREEN_OBJECTS.includes(config.object) && !FABRIC_OBJECTS.includes(config.object) && !PRINT_OBJECTS.includes(config.object) && !SIGNAGE_OBJECTS.includes(config.object)) ? IMPERFECTIONS_HARD : []),
  ];

  const handleCopy = () => {
    let text = generatedPrompt;
    if (copyFormat === 'json') {
      const obj: Record<string, unknown> = {
        object: config.object,
        imageRatio: config.imageRatio,
        camera: config.camera === 'custom' ? `custom(${Math.round(config.customAngle?.pitch ?? 0)}°/${Math.round(config.customAngle?.yaw ?? 0)}°)` : config.camera,
        surface: config.infiniteBackground ? null : config.surface,
        setting: config.infiniteBackground ? null : config.setting,
        infiniteBackground: config.infiniteBackground ? config.infiniteBgColor : false,
        lighting: config.lighting,
        intensity: config.intensity,
        material: config.material,
        assetInput: config.assetInput,
        props: config.props,
        hand: config.hand,
        screenEffects: config.screenEffects,
        imperfections: config.imperfections,
        colors: config.swatchColors,
        colorPalette: config.colorPalette,
        assetDescription: config.assetDescription,
        prompt: generatedPrompt,
      };
      text = JSON.stringify(obj, null, 2);
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    const colors = await extractColorsFromImage(file, 5);
    setConfig(prev => ({ ...prev, swatchColors: colors }));
    setExtracting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addSwatchColor = (hex: string) => {
    if (config.swatchColors.length >= 5) return;
    setConfig(prev => ({ ...prev, swatchColors: [...prev.swatchColors, hex] }));
  };

  const updateSwatchColor = (index: number, hex: string) => {
    setConfig(prev => {
      const next = [...prev.swatchColors];
      next[index] = hex;
      return { ...prev, swatchColors: next };
    });
  };

  const removeSwatchColor = (index: number) => {
    setConfig(prev => ({ ...prev, swatchColors: prev.swatchColors.filter((_, i) => i !== index) }));
  };

  const label = (arr: readonly { id: string; label: string }[], id: string) =>
    arr.find(x => x.id === id)?.label ?? id;

  const isScreenObject = SCREEN_OBJECTS.includes(config.object);
  const isPrintObject = PRINT_OBJECTS.includes(config.object);
  const hasObjectDetails = !!(OBJECT_OPTIONS[config.object]?.length);

  // Wizard navigation
  const totalSteps = WIZARD_STEPS.length;

  const getStepIsSkippable = (idx: number): boolean => {
    const step = WIZARD_STEPS[idx];
    if (step.id === 'details') return !hasObjectDetails;
    if (step.id === 'extras') return true;
    return false;
  };

  const goNext = () => {
    if (wizardStep < totalSteps - 1) {
      setWizardDirection('forward');
      setWizardStep(s => s + 1);
    }
  };

  const goBack = () => {
    if (wizardStep > 0) {
      setWizardDirection('back');
      setWizardStep(s => s - 1);
    }
  };

  const goToStep = (n: number) => {
    setWizardDirection(n > wizardStep ? 'forward' : 'back');
    setWizardStep(n);
  };

  // Filtered objects for category tabs + search
  const filteredObjects = OBJECTS.filter(o => {
    const catMatch = objectCategoryFilter === 'all'
      ? true
      : OBJECT_CATEGORIES.find(c => c.id === objectCategoryFilter)?.objects.includes(o.id as ObjectType) ?? false;
    const searchMatch = objectSearch.trim() === ''
      ? true
      : o.label.toLowerCase().includes(objectSearch.trim().toLowerCase());
    return catMatch && searchMatch;
  });

  // Aspect ratio for canvas frame
  const ratioData = RATIO_DIMENSIONS[config.imageRatio] || { w: 4, h: 3 };

  // Studio summary pills
  const summaryPills = [
    { k: 'Ratio', v: config.imageRatio },
    { k: 'Object', v: label(OBJECTS, config.object) },
    { k: 'Input', v: label(ASSET_INPUTS, config.assetInput) },
    { k: 'Camera', v: config.camera === 'custom' ? `${Math.round(config.customAngle?.pitch ?? 0)}°/${Math.round(config.customAngle?.yaw ?? 0)}°` : label(CAMERAS, config.camera) },
    ...(config.infiniteBackground
      ? [{ k: 'BG', v: `Infinite ${config.infiniteBgColor}` }]
      : [
          { k: 'Surface', v: label(SURFACES, config.surface) },
          { k: 'Setting', v: label(SETTINGS, config.setting) },
        ]),
    { k: 'Light', v: `${label(LIGHTINGS, config.lighting)} ${config.intensity}%` },
    { k: 'Material', v: label(MATERIALS, config.material) },
    ...(config.swatchColors.length > 0 ? [{ k: 'Colors', v: `${config.swatchColors.length}` }] : []),
    ...(config.props.length > 0 ? [{ k: 'Props', v: `${config.props.length}` }] : []),
    ...(config.hand !== 'none' ? [{ k: 'Hand', v: label(HANDS, config.hand) }] : []),
    ...(config.screenEffects.length > 0 ? [{ k: 'FX', v: `${config.screenEffects.length}` }] : []),
    ...(config.imperfections.length > 0 ? [{ k: 'Wear', v: `${config.imperfections.length}` }] : []),
  ];

  const resetPillValue = (key: string) => {
    switch (key) {
      case 'Ratio': setConfig(prev => ({ ...prev, imageRatio: DEFAULT_CONFIG.imageRatio })); break;
      case 'Object': setConfig(prev => ({ ...prev, object: DEFAULT_CONFIG.object, objectDetails: DEFAULT_CONFIG.objectDetails })); break;
      case 'Input': setConfig(prev => ({ ...prev, assetInput: DEFAULT_CONFIG.assetInput, assetDimensions: DEFAULT_CONFIG.assetDimensions })); break;
      case 'Camera': setConfig(prev => ({ ...prev, camera: DEFAULT_CONFIG.camera, customAngle: null })); break;
      case 'BG': setConfig(prev => ({ ...prev, infiniteBackground: false, infiniteBgColor: DEFAULT_CONFIG.infiniteBgColor })); break;
      case 'Surface': setConfig(prev => ({ ...prev, surface: DEFAULT_CONFIG.surface })); break;
      case 'Setting': setConfig(prev => ({ ...prev, setting: DEFAULT_CONFIG.setting })); break;
      case 'Light': setConfig(prev => ({ ...prev, lighting: DEFAULT_CONFIG.lighting, intensity: DEFAULT_CONFIG.intensity })); break;
      case 'Material': setConfig(prev => ({ ...prev, material: DEFAULT_CONFIG.material })); break;
      case 'Colors': setConfig(prev => ({ ...prev, swatchColors: [] })); break;
      case 'Props': setConfig(prev => ({ ...prev, props: [] })); break;
      case 'Hand': setConfig(prev => ({ ...prev, hand: 'none' })); break;
      case 'FX': setConfig(prev => ({ ...prev, screenEffects: [] })); break;
      case 'Wear': setConfig(prev => ({ ...prev, imperfections: [] })); break;
    }
  };

  // ── Color swatches UI (shared between wizard + studio) ─────────────────

  const ColorSwatchesUI = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {config.swatchColors.map((color, i) => (
          <div key={i} className="relative group">
            <label className="block w-11 h-11 rounded-xl border-2 border-[--border] cursor-pointer overflow-hidden hover:border-[--accent-dim] transition-colors"
              style={{ backgroundColor: color }}>
              <input type="color" value={color}
                onChange={e => updateSwatchColor(i, e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
            </label>
            <button onClick={() => removeSwatchColor(i)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[--danger] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X size={8} strokeWidth={3} />
            </button>
            <span className="block text-[9px] font-mono text-[--foreground-dim] text-center mt-1 leading-none">{color}</span>
          </div>
        ))}
        {config.swatchColors.length < 5 && (
          <label className="relative w-11 h-11 rounded-xl border-2 border-dashed border-[--border] cursor-pointer flex items-center justify-center hover:border-[--accent-dim] transition-colors">
            <Plus size={14} className="text-[--foreground-dim]" />
            <input type="color" value="#D4A843"
              onChange={e => addSwatchColor(e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
          </label>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageExtract} className="hidden" />
      <button onClick={() => fileInputRef.current?.click()} disabled={extracting}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[--border] text-[13px] font-medium transition-all bg-[--bg-surface] text-[--foreground-muted] hover:border-[--border-accent] hover:text-[--foreground]">
        {extracting ? (
          <><div className="w-3 h-3 border-2 border-[--accent]/30 border-t-[--accent] rounded-full animate-spin" /><span>Extracting...</span></>
        ) : (
          <><ImagePlus size={14} /><span>Extract from Image</span></>
        )}
      </button>
      <p className="text-[11px] text-[--foreground-dim]">100% local — never uploaded.</p>
      {config.swatchColors.length > 0 && (
        <button onClick={() => setConfig(prev => ({ ...prev, swatchColors: [] }))}
          className="text-[12px] font-bold text-[--foreground-dim] hover:text-[--accent] transition-colors flex items-center gap-1">
          <RotateCcw size={10} /> Clear colors
        </button>
      )}
    </div>
  );

  // ── Mode switcher button ────────────────────────────────────────────────

  const ModeSwitcher = ({ compact = false }: { compact?: boolean }) => (
    <div className={cn("flex items-center rounded-xl border border-[--border] overflow-hidden bg-[--bg-surface]", compact && "text-[12px]")}>
      <button
        onClick={() => { setUiMode('wizard'); setWizardStep(0); }}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 transition-all font-semibold",
          compact ? "text-[11px] px-2.5 py-1.5" : "text-[13px]",
          uiMode === 'wizard'
            ? "bg-[--accent-subtle] text-[--accent] border-[--accent]"
            : "text-[--foreground-dim] hover:text-[--foreground]"
        )}>
        <Wand2 size={compact ? 11 : 13} />
        {!compact && 'Wizard'}
      </button>
      <button
        onClick={() => setUiMode('studio')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 transition-all font-semibold",
          compact ? "text-[11px] px-2.5 py-1.5" : "text-[13px]",
          uiMode === 'studio'
            ? "bg-[--accent-subtle] text-[--accent] border-[--accent]"
            : "text-[--foreground-dim] hover:text-[--foreground]"
        )}>
        <LayoutGrid size={compact ? 11 : 13} />
        {!compact && 'Studio'}
      </button>
    </div>
  );

  // ── Prompt display (shared canvas content) ─────────────────────────────

  const PromptCanvas = ({ compact = false }: { compact?: boolean }) => (
    <div className={cn("relative", compact && "")}>
      <div
        className="relative bg-[--bg-raised] rounded-2xl border border-[--border] overflow-hidden shadow-2xl shadow-black/20"
        style={{
          aspectRatio: `${ratioData.w} / ${ratioData.h}`,
          maxHeight: compact ? '60vh' : '80vh',
          minHeight: '300px',
        }}>
        <div className="absolute top-4 left-4 text-[11px] font-mono font-bold text-[--foreground-dim]/40">
          {config.imageRatio}
        </div>
        <div className="absolute inset-0 p-6 md:p-8 flex flex-col">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Sparkles size={14} className="text-[--accent]" />
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-[--accent]">Live Prompt</h3>
            <div className="flex-1" />
            <div className="flex gap-1">
              {['8K', 'Hasselblad', 'UE5'].map(tag => (
                <span key={tag} className="px-1.5 py-0.5 bg-[--bg-surface] text-[9px] font-bold text-[--foreground-dim] rounded border border-[--border] uppercase">{tag}</span>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-0">
            {promptSegments.map((seg, i) => (
              <div key={i} className={cn("pb-3", i < promptSegments.length - 1 && "border-b border-[--border]/40 mb-3")}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[--accent] block mb-1">{seg.label}</span>
                <p className="text-[15px] leading-relaxed text-[--foreground] font-medium">{seg.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // WIZARD MODE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const slideVariants = {
    enter: (dir: string) => ({ x: dir === 'forward' ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: string) => ({ x: dir === 'forward' ? -60 : 60, opacity: 0 }),
  };

  const stepInfo = WIZARD_STEPS[wizardStep];

  // Wizard step content
  const renderWizardStep = () => {
    switch (stepInfo.id) {

      // ── Step 0: Quick Start / Presets ────────────────────────────────
      case 'presets': return (
        <div className="space-y-6">
          <button
            onClick={() => { setConfig(DEFAULT_CONFIG); goNext(); }}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-dashed border-[--border] hover:border-[--accent] hover:bg-[--accent-subtle] transition-all group">
            <div className="w-12 h-12 rounded-xl bg-[--bg-surface] flex items-center justify-center shrink-0 group-hover:bg-[--accent]/10">
              <Plus size={20} className="text-[--foreground-dim] group-hover:text-[--accent]" />
            </div>
            <div className="text-left">
              <div className="text-base font-semibold text-[--foreground] mb-0.5">Start from scratch</div>
              <div className="text-sm text-[--foreground-muted]">Begin with default settings</div>
            </div>
            <ArrowRight size={18} className="ml-auto text-[--foreground-dim] group-hover:text-[--accent] transition-colors" />
          </button>

          <div>
            <p className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase mb-3">Built-in Presets</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BUILT_IN_PRESETS.map(preset => {
                const ObjIcon = OBJECT_ICONS[preset.config.object] || Package;
                return (
                  <button key={preset.name}
                    onClick={() => { loadPreset(preset); goNext(); }}
                    className="flex items-center gap-3 p-4 rounded-2xl border border-[--border] bg-[--bg-raised] hover:border-[--accent-dim] hover:bg-[--bg-surface] transition-all text-left group">
                    <div className="w-10 h-10 rounded-xl bg-[--bg-surface] group-hover:bg-[--accent-subtle] flex items-center justify-center shrink-0 transition-colors">
                      <ObjIcon size={18} className="text-[--foreground-muted] group-hover:text-[--accent]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[--foreground] truncate">{preset.name}</div>
                      <div className="text-xs text-[--foreground-muted] truncate">{label(OBJECTS, preset.config.object)} &middot; {label(CAMERAS, preset.config.camera)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {presets.length > 0 && (
            <div>
              <p className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase mb-3">My Presets</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {presets.map(preset => {
                  const ObjIcon = OBJECT_ICONS[preset.config.object] || Package;
                  return (
                    <div key={preset.name}
                      className="flex items-center gap-3 p-4 rounded-2xl border border-[--border] bg-[--bg-raised] hover:border-[--border-accent] transition-all group">
                      <div className="w-10 h-10 rounded-xl bg-[--bg-surface] flex items-center justify-center shrink-0">
                        <ObjIcon size={18} className="text-[--foreground-muted]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[--foreground] truncate">{preset.name}</div>
                        <div className="text-xs text-[--foreground-muted]">{new Date(preset.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                      </div>
                      <button onClick={() => { loadPreset(preset); goNext(); }}
                        className="px-3 py-1.5 rounded-lg bg-[--bg-surface] text-[12px] font-semibold text-[--foreground-muted] hover:bg-[--accent-subtle] hover:text-[--accent] transition-all">
                        Load
                      </button>
                      <button onClick={() => deletePreset(preset.name)}
                        className="p-1.5 rounded-lg text-[--foreground-dim] hover:text-[--danger] hover:bg-[--danger]/10 transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );

      // ── Step 1: Object ───────────────────────────────────────────────
      case 'object': return (
        <div className="space-y-4">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--foreground-dim] pointer-events-none" />
            <input
              type="text"
              value={objectSearch}
              onChange={e => setObjectSearch(e.target.value)}
              placeholder="Search objects..."
              autoComplete="off"
              className="w-full pl-10 pr-9 py-3 text-sm bg-[--bg-inset] border border-[--border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--accent-dim] text-[--foreground] placeholder:text-[--foreground-dim]"
            />
            {objectSearch && (
              <button onClick={() => setObjectSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[--foreground-dim] hover:text-[--foreground]">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {OBJECT_CATEGORIES.map(cat => (
              <button key={cat.id}
                onClick={() => setObjectCategoryFilter(cat.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                  objectCategoryFilter === cat.id
                    ? "bg-[--accent-subtle] text-[--accent] border-[--accent]"
                    : "text-[--foreground-muted] hover:text-[--foreground] bg-[--bg-surface] border border-[--border]"
                )}>
                {cat.label}
              </button>
            ))}
          </div>

          {filteredObjects.length === 0 ? (
            <p className="text-sm text-[--foreground-muted] py-6 text-center">No objects match your search</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredObjects.map(obj => {
                const ObjIcon = OBJECT_ICONS[obj.id] || Package;
                const isActive = config.object === obj.id;
                return (
                  <button key={obj.id}
                    onClick={() => setConfig(prev => ({ ...prev, object: obj.id as ObjectType, objectDetails: getObjectDefaults(obj.id as ObjectType) }))}
                    className={cn(
                      "flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 text-center transition-all",
                      isActive
                        ? "border-[--accent] bg-[--accent-subtle] text-[--accent]"
                        : "border-[--border] bg-[--bg-raised] text-[--foreground-muted] hover:border-[--accent-dim] hover:text-[--foreground]"
                    )}>
                    <ObjIcon size={22} strokeWidth={1.5} />
                    <span className="text-xs font-semibold leading-tight">{obj.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );

      // ── Step 2: Object Details ────────────────────────────────────────
      case 'details': return (
        <div className="space-y-6">
          {hasObjectDetails ? (
            <>
              {(OBJECT_OPTIONS[config.object] ?? []).map(opt => (
                <div key={opt.key} className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
                  <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">{opt.label}</label>
                  <div className={cn("grid gap-2", opt.choices.length <= 3 ? "grid-cols-3" : "grid-cols-2")}>
                    {opt.choices.map(choice => (
                      <TogglePill key={choice.id} label={choice.label}
                        active={(config.objectDetails[opt.key] ?? opt.default) === choice.id}
                        onClick={() => setConfig(prev => ({
                          ...prev, objectDetails: { ...prev.objectDetails, [opt.key]: choice.id },
                        }))} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="py-8 text-center text-[--foreground-muted] text-sm">
              No extra options for {label(OBJECTS, config.object)}.
            </div>
          )}

          {isPrintObject && (
            <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
              <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Material Finish</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MATERIALS.map(mat => (
                  <TogglePill key={mat.id} label={mat.label} active={config.material === mat.id}
                    onClick={() => setConfig(prev => ({ ...prev, material: mat.id as MaterialType }))} />
                ))}
              </div>
            </div>
          )}
        </div>
      );

      // ── Step 3: Camera & Ratio ────────────────────────────────────────
      case 'camera': return (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Image Ratio</label>
            <div className="grid grid-cols-4 gap-2">
              {IMAGE_RATIOS.map(r => {
                const rd = RATIO_DIMENSIONS[r.id] || { w: 4, h: 3 };
                const isActive = config.imageRatio === r.id;
                return (
                  <button key={r.id}
                    onClick={() => setConfig(prev => ({ ...prev, imageRatio: r.id as ImageRatio }))}
                    className={cn(
                      "flex flex-col items-center gap-2 py-3 px-1 rounded-xl border-2 transition-all",
                      isActive
                        ? "border-[--accent] bg-[--accent-subtle] text-[--accent]"
                        : "border-[--border] bg-[--bg-surface] text-[--foreground-muted] hover:border-[--accent-dim]"
                    )}>
                    <div className="flex items-center justify-center w-8 h-8">
                      <div className={cn("border-2 rounded-sm", isActive ? "border-[--bg-base]" : "border-[--foreground-dim]")} style={{
                        width: `${Math.min(24, (rd.w / Math.max(rd.w, rd.h)) * 24)}px`,
                        height: `${Math.min(24, (rd.h / Math.max(rd.w, rd.h)) * 24)}px`,
                      }} />
                    </div>
                    <span className="text-[11px] font-bold">{r.id}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Camera Angle</label>
            <div className="grid grid-cols-2 gap-2">
              {CAMERAS.map(cam => (
                <TogglePill key={cam.id} label={cam.label} active={config.camera === cam.id}
                  onClick={() => setConfig(prev => ({
                    ...prev, camera: cam.id as CameraAngle,
                    customAngle: cam.id === 'custom' ? (prev.customAngle || { pitch: 30, yaw: 30 }) : prev.customAngle,
                  }))} />
              ))}
            </div>
            {config.camera === 'custom' && (
              <div className="pt-2">
                <AngleWidget angle={config.customAngle || { pitch: 30, yaw: 30 }}
                  onChange={a => setConfig(prev => ({ ...prev, customAngle: a }))} />
              </div>
            )}
          </div>
        </div>
      );

      // ── Step 4: Environment ───────────────────────────────────────────
      case 'environment': return (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Infinite Background</label>
              <button
                onClick={() => setConfig(prev => ({ ...prev, infiniteBackground: !prev.infiniteBackground }))}
                className={cn(
                  "w-10 h-5.5 rounded-full transition-colors relative flex items-center",
                  config.infiniteBackground ? "bg-[--accent]" : "bg-[--border-light]"
                )}>
                <div className={cn(
                  "absolute w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                  config.infiniteBackground ? "translate-x-5" : "translate-x-0.5"
                )} />
              </button>
            </div>
            {config.infiniteBackground && (
              <div className="flex items-center gap-3 pt-1">
                <input type="color" value={config.infiniteBgColor}
                  onChange={e => setConfig(prev => ({ ...prev, infiniteBgColor: e.target.value }))}
                  className="w-11 h-11 rounded-xl border border-[--border] cursor-pointer p-0.5 bg-transparent" />
                <input type="text" value={config.infiniteBgColor}
                  onChange={e => setConfig(prev => ({ ...prev, infiniteBgColor: e.target.value }))}
                  className="flex-1 p-2.5 text-sm font-mono bg-[--bg-inset] border border-[--border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--accent-dim] text-[--foreground]" />
              </div>
            )}
          </div>

          {!config.infiniteBackground && (
            <>
              <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
                <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Surface</label>
                <div className="grid grid-cols-2 gap-2">
                  {SURFACES.map(srf => (
                    <TogglePill key={srf.id} label={srf.label} active={config.surface === srf.id}
                      onClick={() => setConfig(prev => ({ ...prev, surface: srf.id as SurfaceType }))} />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
                <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Setting</label>
                <div className="grid grid-cols-2 gap-2">
                  {SETTINGS.map(s => (
                    <TogglePill key={s.id} label={s.label} active={config.setting === s.id}
                      onClick={() => setConfig(prev => ({ ...prev, setting: s.id as SettingType }))} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      );

      // ── Step 5: Lighting ──────────────────────────────────────────────
      case 'lighting': return (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Lighting Style</label>
            <div className="grid grid-cols-2 gap-2">
              {LIGHTINGS.map(lt => (
                <TogglePill key={lt.id} label={lt.label} active={config.lighting === lt.id}
                  onClick={() => setConfig(prev => ({ ...prev, lighting: lt.id as LightingType }))} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Intensity</label>
              <span className="text-sm font-mono font-bold text-[--accent]">{config.intensity}%</span>
            </div>
            <input type="range" min="0" max="100" value={config.intensity}
              onChange={e => setConfig(prev => ({ ...prev, intensity: parseInt(e.target.value) }))}
              className="w-full cursor-pointer" />
          </div>
        </div>
      );

      // ── Step 6: Style & Brand ─────────────────────────────────────────
      case 'style': return (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Asset Input Type</label>
            <div className="grid grid-cols-1 gap-2">
              {ASSET_INPUTS.map(ai => (
                <TogglePill key={ai.id} label={ai.label} active={config.assetInput === ai.id}
                  onClick={() => setConfig(prev => ({ ...prev, assetInput: ai.id as AssetInputType }))} />
              ))}
            </div>
            {config.assetInput === 'design-custom' && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Dimensions</label>
                <input type="text" value={config.assetDimensions}
                  onChange={e => setConfig(prev => ({ ...prev, assetDimensions: e.target.value }))}
                  placeholder="e.g. 1920x1080px, A4, 210x297mm"
                  className="w-full p-3 text-sm bg-[--bg-inset] border border-[--border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--accent-dim] text-[--foreground] placeholder:text-[--foreground-dim]" />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Color Swatches</label>
            <ColorSwatchesUI />
          </div>

          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Color Palette Description</label>
            <input type="text" value={config.colorPalette ?? ''}
              onChange={e => setConfig(prev => ({ ...prev, colorPalette: e.target.value }))}
              placeholder="Warm neutrals, off-whites..."
              className="w-full p-3 text-sm bg-[--bg-inset] border border-[--border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--accent-dim] text-[--foreground] placeholder:text-[--foreground-dim]" />
          </div>

          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Asset Description</label>
            <textarea value={config.assetDescription}
              onChange={e => setConfig(prev => ({ ...prev, assetDescription: e.target.value }))}
              placeholder="e.g. A minimalist serif logo for a boutique hotel, embossed in dark olive green..."
              className="w-full h-24 p-3 text-sm bg-[--bg-inset] border border-[--border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--accent-dim] resize-none text-[--foreground] placeholder:text-[--foreground-dim]" />
          </div>
        </div>
      );

      // ── Step 7: Extras ────────────────────────────────────────────────
      case 'extras': return (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Props</label>
            <p className="text-xs text-[--foreground-muted]">Multi-select. Props appear near the hero object.</p>
            <div className="grid grid-cols-2 gap-2">
              {PROPS.map(p => (
                <TogglePill key={p.id} label={p.label} active={config.props.includes(p.id as PropType)}
                  onClick={() => toggleProp(p.id as PropType)} />
              ))}
            </div>
            {config.props.length > 0 && (
              <button onClick={() => setConfig(prev => ({ ...prev, props: [] }))}
                className="text-xs font-bold text-[--foreground-dim] hover:text-[--accent] transition-colors flex items-center gap-1 pt-1">
                <RotateCcw size={10} /> Clear all
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Hand Interaction</label>
            <div className="grid grid-cols-2 gap-2">
              {HANDS.map(h => (
                <TogglePill key={h.id} label={h.label} active={config.hand === h.id}
                  onClick={() => setConfig(prev => ({ ...prev, hand: h.id as HandMode }))} />
              ))}
            </div>
          </div>

          {isScreenObject && (
            <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
              <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Screen Effects</label>
              <div className="grid grid-cols-1 gap-2">
                {SCREEN_EFFECTS.map(fx => (
                  <TogglePill key={fx.id} label={fx.label} active={config.screenEffects.includes(fx.id as ScreenEffectType)}
                    onClick={() => toggleScreenEffect(fx.id as ScreenEffectType)} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Imperfections</label>
            <p className="text-xs text-[--foreground-muted]">Ultra-subtle details for photographic realism.</p>
            <div className="grid grid-cols-2 gap-2">
              {availableImperfections.map(imp => (
                <TogglePill key={imp.id} label={imp.label} active={config.imperfections.includes(imp.id as ImperfectionType)}
                  onClick={() => toggleImperfection(imp.id as ImperfectionType)} />
              ))}
            </div>
            {config.imperfections.length > 0 && (
              <button onClick={() => setConfig(prev => ({ ...prev, imperfections: [] }))}
                className="text-xs font-bold text-[--foreground-dim] hover:text-[--accent] transition-colors flex items-center gap-1 pt-1">
                <RotateCcw size={10} /> Clear all
              </button>
            )}
          </div>
        </div>
      );

      // ── Step 8: Review ────────────────────────────────────────────────
      case 'review': return (
        <div className="space-y-5">
          {/* Config summary pills */}
          <div className="flex flex-wrap gap-1.5">
            {summaryPills.map(pill => (
              <span key={pill.k} className="flex items-center gap-1.5 px-2.5 py-1 bg-[--bg-surface] border border-[--border] rounded-full">
                <span className="text-[10px] font-bold text-[--foreground-dim] uppercase">{pill.k}</span>
                <span className="text-xs font-semibold text-[--foreground-muted]">{pill.v}</span>
              </span>
            ))}
            {config.swatchColors.length > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-[--bg-surface] border border-[--border] rounded-full">
                {config.swatchColors.map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-full border border-[--border-light]" style={{ backgroundColor: c }} />
                ))}
              </span>
            )}
          </div>

          {/* Prompt quality */}
          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Prompt Richness</span>
              <span className="text-sm font-bold text-[--accent]">{completeness.label} — {completeness.score}%</span>
            </div>
            <div className="h-1.5 bg-[--border] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[--accent-dim] to-[--accent]"
                animate={{ width: `${completeness.score}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Copy controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-[--border] overflow-hidden bg-[--bg-surface]">
              <button onClick={() => setCopyFormat('text')}
                className={cn("px-3 py-2 text-xs font-bold transition-all", copyFormat === 'text' ? "bg-[--accent-subtle] text-[--accent] border-[--accent]" : "text-[--foreground-dim] hover:text-[--foreground]")}>
                Text
              </button>
              <button onClick={() => setCopyFormat('json')}
                className={cn("px-3 py-2 text-xs font-bold transition-all flex items-center gap-1", copyFormat === 'json' ? "bg-[--accent-subtle] text-[--accent] border-[--accent]" : "text-[--foreground-dim] hover:text-[--foreground]")}>
                <Braces size={11} /> JSON
              </button>
            </div>
            <button onClick={handleCopy}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                copied
                  ? "bg-[--success]/20 text-[--success] border border-[--success]/30"
                  : "bg-[--accent]/90 text-[--bg-base] hover:bg-[--accent] shadow-sm"
              )}>
              {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy {copyFormat === 'json' ? 'JSON' : 'Prompt'}</>}
            </button>
          </div>

          {/* Structured prompt */}
          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] overflow-hidden">
            <div className="p-4 border-b border-[--border] flex items-center gap-2">
              <Sparkles size={14} className="text-[--accent]" />
              <span className="text-xs font-bold tracking-widest uppercase text-[--accent]">Live Prompt</span>
              <div className="ml-auto flex gap-1.5">
                <span className="text-xs text-[--foreground-dim] font-mono">{wordCount} words</span>
              </div>
            </div>
            <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
              {promptSegments.map((seg, i) => (
                <div key={i} className={cn("pb-3", i < promptSegments.length - 1 && "border-b border-[--border]/40")}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[--accent] block mb-1">{seg.label}</span>
                  <p className="text-sm leading-relaxed text-[--foreground]">{seg.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Save preset */}
          <div className="rounded-2xl border border-[--border] bg-[--bg-raised] p-5 space-y-3">
            <label className="text-xs font-bold tracking-widest text-[--foreground-dim] uppercase">Save as Preset</label>
            <div className="flex gap-2">
              <input type="text" value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && savePreset()}
                placeholder="My preset name..."
                className="flex-1 px-3 py-2.5 text-sm bg-[--bg-inset] border border-[--border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--accent-dim] text-[--foreground] placeholder:text-[--foreground-dim]" />
              <button onClick={savePreset} disabled={!presetName.trim()}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                  presetSaved
                    ? "bg-[--success]/20 text-[--success] border border-[--success]/30"
                    : presetName.trim()
                      ? "bg-[--accent]/90 text-[--bg-base] hover:bg-[--accent]"
                      : "bg-[--bg-surface] text-[--foreground-dim] border border-[--border] cursor-not-allowed"
                )}>
                {presetSaved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save</>}
              </button>
            </div>
          </div>

          <button onClick={() => setUiMode('studio')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[--border] text-sm font-semibold text-[--foreground-muted] hover:border-[--accent-dim] hover:text-[--accent] transition-all">
            <LayoutGrid size={15} />
            Open in Studio mode
          </button>
        </div>
      );

      default: return null;
    }
  };

  // ── Wizard Layout ────────────────────────────────────────────────────────

  if (uiMode === 'wizard') {
    return (
      <main className="min-h-screen bg-[--bg-base] text-[--foreground] flex flex-col" style={{ fontFamily: SYSTEM_FONT }}>
        {/* Wizard header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[--bg-base]/90 border-b border-[--border]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[--accent] to-[--accent-dim] flex items-center justify-center">
                <Wand2 size={13} className="text-[--bg-base]" strokeWidth={2.5} />
              </div>
              <span className="text-[11px] font-bold tracking-[0.2em] text-[--accent] uppercase hidden sm:block">Nano Banana</span>
            </div>

            {/* Segmented progress */}
            <div className="flex-1 flex items-center gap-1">
              {WIZARD_STEPS.map((step, i) => (
                <button key={step.id}
                  onClick={() => goToStep(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i < wizardStep ? "bg-[--accent] flex-1" :
                    i === wizardStep ? "bg-[--accent] flex-[2]" :
                    "bg-[--border] flex-1"
                  )} />
              ))}
            </div>

            <span className="text-xs font-mono text-[--foreground-dim] shrink-0">{wizardStep + 1}/{totalSteps}</span>
            <ModeSwitcher compact />
          </div>
        </header>

        {/* Wizard content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <AnimatePresence mode="wait" custom={wizardDirection}>
              <motion.div
                key={wizardStep}
                custom={wizardDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}>

                {/* Step header */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    {React.createElement(stepInfo.icon, { size: 18, className: "text-[--accent]" })}
                    <span className="text-xs font-bold tracking-widest text-[--accent] uppercase">
                      Step {wizardStep + 1} of {totalSteps}
                    </span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-[--foreground] mb-2 leading-tight">
                    {stepInfo.title}
                  </h1>
                  <p className="text-base text-[--foreground-muted]">{stepInfo.subtitle}</p>
                </div>

                {/* Step body */}
                {renderWizardStep()}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Wizard footer nav */}
        <div className="sticky bottom-0 bg-[--bg-base]/95 backdrop-blur-xl border-t border-[--border]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <button
              onClick={goBack}
              disabled={wizardStep === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                wizardStep === 0
                  ? "text-[--foreground-dim] cursor-not-allowed"
                  : "text-[--foreground-muted] hover:text-[--foreground] hover:bg-[--bg-surface] border border-[--border]"
              )}>
              <ArrowLeft size={15} />
              Back
            </button>

            <div className="flex-1" />

            {getStepIsSkippable(wizardStep) && (
              <button onClick={goNext}
                className="text-sm font-medium text-[--foreground-dim] hover:text-[--foreground-muted] transition-colors px-3 py-2.5">
                Skip
              </button>
            )}

            {wizardStep < totalSteps - 1 ? (
              <button onClick={goNext}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[--accent] text-[--bg-base] text-sm font-bold hover:bg-[--accent-hover] transition-all shadow-sm">
                Next
                <ArrowRight size={15} />
              </button>
            ) : (
              <button onClick={handleCopy}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                  copied
                    ? "bg-[--success]/20 text-[--success] border border-[--success]/30"
                    : "bg-[--accent]/90 text-[--bg-base] hover:bg-[--accent] shadow-sm"
                )}>
                {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Prompt</>}
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STUDIO MODE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const visibleSections = SECTIONS.filter(s => {
    if (s.id === 'screen-fx' && !isScreenObject) return false;
    if (s.id === 'object-details' && !hasObjectDetails && !isPrintObject) return false;
    if ((s.id === 'surface' || s.id === 'setting') && config.infiniteBackground) return false;
    return true;
  });

  const StudioSidebar = () => (
    <>
      {/* Logo */}
      <div className="px-6 pt-5 pb-4 border-b border-[--border] shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[--accent] to-[--accent-dim] flex items-center justify-center">
            <Wand2 size={16} className="text-[--bg-base]" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-[0.25em] text-[--accent] uppercase block leading-none mb-0.5">Nano Banana Pro</span>
            <h1 className="text-base font-bold text-[--foreground] leading-none">Mockup Studio</h1>
          </div>
          <button className="ml-auto md:hidden text-[--foreground-dim] hover:text-[--foreground] p-1" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Preset bar + quality */}
      <div className="border-b border-[--border] shrink-0">
        <div className="px-6 py-2.5 flex items-center gap-2">
          <button onClick={() => setShowPresetPanel(!showPresetPanel)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              showPresetPanel
                ? "bg-[--accent-subtle] text-[--accent] border border-[--border-accent]"
                : "text-[--foreground-muted] hover:text-[--foreground] hover:bg-[--bg-surface] border border-transparent"
            )}>
            <FolderOpen size={12} />
            Presets
            {(presets.length > 0 || BUILT_IN_PRESETS.length > 0) && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[--accent-subtle] text-[--accent] text-[10px] font-bold">{presets.length + BUILT_IN_PRESETS.length}</span>
            )}
          </button>
          <div className="flex-1" />
          <button onClick={() => { setUiMode('wizard'); setWizardStep(0); }}
            className="text-[11px] font-bold text-[--foreground-dim] hover:text-[--accent] transition-colors flex items-center gap-1">
            <Wand2 size={9} /> Wizard
          </button>
          <button onClick={() => setConfig(DEFAULT_CONFIG)}
            className="text-[11px] font-bold text-[--foreground-dim] hover:text-[--accent] transition-colors flex items-center gap-1">
            <RotateCcw size={9} /> Reset
          </button>
        </div>

        {/* Preset panel */}
        <AnimatePresence>
          {showPresetPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden">
              <div className="px-6 pb-3 space-y-2.5">
                <div className="flex gap-1.5">
                  <input type="text" value={presetName}
                    onChange={e => setPresetName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && savePreset()}
                    placeholder="Preset name..."
                    className="flex-1 px-2.5 py-1.5 text-[13px] bg-[--bg-inset] border border-[--border] rounded-lg focus:outline-none focus:ring-1 focus:ring-[--accent-dim] text-[--foreground] placeholder:text-[--foreground-dim]" />
                  <button onClick={savePreset} disabled={!presetName.trim()}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      presetSaved ? "bg-[--success]/20 text-[--success] border border-[--success]/30"
                        : presetName.trim() ? "bg-[--accent]/90 text-[--bg-base] hover:bg-[--accent]"
                          : "bg-[--bg-surface] text-[--foreground-dim] border border-[--border] cursor-not-allowed"
                    )}>
                    {presetSaved ? <><Check size={11} /> Saved</> : <><Save size={11} /> Save</>}
                  </button>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-[--foreground-dim] uppercase tracking-widest mb-1.5">Built-in</p>
                  <div className="space-y-1 max-h-[130px] overflow-y-auto">
                    {BUILT_IN_PRESETS.map(preset => (
                      <div key={preset.name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[--border] bg-[--bg-inset] hover:border-[--accent-dim] transition-colors">
                        <button onClick={() => loadPreset(preset)} className="flex-1 text-left text-[12px] font-medium text-[--foreground-muted] hover:text-[--foreground] transition-colors truncate">
                          {preset.name}
                        </button>
                        <span className="text-[10px] text-[--accent] font-bold border border-[--border-accent] rounded px-1 shrink-0">Built-in</span>
                      </div>
                    ))}
                  </div>
                </div>

                {presets.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[--foreground-dim] uppercase tracking-widest mb-1.5">My Presets</p>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {presets.map(preset => (
                        <div key={preset.name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[--border] bg-[--bg-surface] hover:border-[--border-accent] transition-colors group">
                          <button onClick={() => loadPreset(preset)} className="flex-1 text-left text-[12px] font-medium text-[--foreground-muted] hover:text-[--foreground] transition-colors truncate">
                            {preset.name}
                          </button>
                          <button onClick={() => deletePreset(preset.name)} className="opacity-0 group-hover:opacity-100 text-[--foreground-dim] hover:text-[--danger] transition-all p-0.5">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {presets.length === 0 && <p className="text-xs text-[--foreground-dim] py-1 text-center">No saved presets yet</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prompt quality */}
        <div className="px-6 py-2.5 flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold tracking-widest text-[--foreground-dim] uppercase">Prompt richness</span>
              <span className="text-xs font-bold text-[--accent]">{completeness.label}</span>
            </div>
            <div className="h-1 bg-[--border] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[--accent-dim] to-[--accent]"
                initial={false}
                animate={{ width: `${completeness.score}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>
          <span className="text-lg font-bold font-mono text-[--accent] tabular-nums">{completeness.score}</span>
        </div>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto">
        <div className="py-0.5">
          {visibleSections.map((section) => {
            const isOpen = openSections.has(section.id);
            const Icon = section.icon;
            const isModified = getSectionModified(section.id, config);

            let summary = '';
            switch (section.id) {
              case 'ratio': summary = label(IMAGE_RATIOS, config.imageRatio); break;
              case 'object': summary = label(OBJECTS, config.object); break;
              case 'object-details': {
                const defs = OBJECT_OPTIONS[config.object] ?? [];
                const customized = defs.filter(d => (config.objectDetails[d.key] ?? d.default) !== d.default).length;
                summary = customized > 0 ? `${customized} customized` : 'Defaults'; break;
              }
              case 'asset-input': summary = label(ASSET_INPUTS, config.assetInput); break;
              case 'camera': summary = config.camera === 'custom' ? 'Custom 3D' : label(CAMERAS, config.camera); break;
              case 'surface': summary = label(SURFACES, config.surface); break;
              case 'setting': summary = label(SETTINGS, config.setting); break;
              case 'lighting': summary = label(LIGHTINGS, config.lighting); break;
              case 'colors': summary = config.swatchColors.length > 0 ? `${config.swatchColors.length} colors` : 'None'; break;
              case 'props': summary = config.props.length > 0 ? `${config.props.length} selected` : 'None'; break;
              case 'hand': summary = label(HANDS, config.hand); break;
              case 'screen-fx': summary = config.screenEffects.length > 0 ? `${config.screenEffects.length} active` : 'None'; break;
              case 'imperfections': summary = config.imperfections.length > 0 ? `${config.imperfections.length} selected` : 'None'; break;
              case 'infinite-bg': summary = config.infiniteBackground ? 'On' : 'Off'; break;
              case 'brand': summary = config.assetDescription ? 'Configured' : 'Set up'; break;
            }

            return (
              <div key={section.id} className="border-b border-[--border]">
                <button onClick={() => toggleSection(section.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-6 py-3 transition-colors",
                    isModified && !isOpen ? "bg-[--accent-subtle]/50" : "",
                    isOpen ? "bg-[--accent-subtle]" : "hover:bg-[--bg-surface-hover]"
                  )}>
                  <div className="flex items-center gap-2.5">
                    {isModified ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-[--accent] shrink-0 shadow-none" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-transparent shrink-0" />
                    )}
                    <Icon size={13} className={cn(isModified ? "text-[--accent]" : isOpen ? "text-[--accent]" : "text-[--foreground-dim]")} strokeWidth={2} />
                    <span className={cn("text-[12px] font-semibold tracking-wide uppercase", isModified ? "text-[--accent]" : isOpen ? "text-[--accent]" : "text-[--foreground-muted]")}>
                      {section.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[11px] font-medium truncate max-w-[90px]", isModified ? "text-[--accent-dim]" : "text-[--foreground-dim]")}>{summary}</span>
                    <ChevronDown size={11} className={cn("text-[--foreground-dim] transition-transform duration-200", isOpen && "rotate-180")} />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden">
                      <div className="px-6 pb-5 pt-2 space-y-4">

                        {/* ── Image Ratio ── */}
                        {section.id === 'ratio' && (
                          <div className="grid grid-cols-4 gap-1.5">
                            {IMAGE_RATIOS.map(r => {
                              const rd = RATIO_DIMENSIONS[r.id] || { w: 4, h: 3 };
                              const isActive = config.imageRatio === r.id;
                              return (
                                <button key={r.id}
                                  onClick={() => setConfig(prev => ({ ...prev, imageRatio: r.id as ImageRatio }))}
                                  className={cn(
                                    "flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border transition-all",
                                    isActive ? "border-[--accent] bg-[--accent-subtle] text-[--accent]" : "border-[--border] bg-[--bg-surface] text-[--foreground-muted] hover:border-[--border-accent]"
                                  )}>
                                  <div className="flex items-center justify-center w-8 h-8">
                                    <div className={cn("border-2 rounded-sm", isActive ? "border-[--bg-base]" : "border-[--foreground-dim]")} style={{
                                      width: `${Math.min(24, (rd.w / Math.max(rd.w, rd.h)) * 24)}px`,
                                      height: `${Math.min(24, (rd.h / Math.max(rd.w, rd.h)) * 24)}px`,
                                    }} />
                                  </div>
                                  <span className="text-[11px] font-bold">{r.id}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* ── Object ── */}
                        {section.id === 'object' && (
                          <div className="space-y-3">
                            <div className="relative">
                              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[--foreground-dim] pointer-events-none" />
                              <input type="text" value={objectSearch}
                                onChange={e => setObjectSearch(e.target.value)}
                                placeholder="Search objects..."
                                autoComplete="off"
                                className="w-full pl-8 pr-8 py-2 text-[13px] bg-[--bg-inset] border border-[--border] rounded-lg focus:outline-none focus:ring-1 focus:ring-[--accent-dim] text-[--foreground] placeholder:text-[--foreground-dim]" />
                              {objectSearch && (
                                <button onClick={() => setObjectSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[--foreground-dim] hover:text-[--foreground]">
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                            <div className="flex gap-1 overflow-x-auto pb-1">
                              {OBJECT_CATEGORIES.map(cat => (
                                <button key={cat.id}
                                  onClick={() => setObjectCategoryFilter(cat.id)}
                                  className={cn(
                                    "px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                                    objectCategoryFilter === cat.id ? "bg-[--accent-subtle] text-[--accent] border-[--accent]" : "text-[--foreground-dim] hover:text-[--foreground-muted] hover:bg-[--bg-surface]"
                                  )}>
                                  {cat.label}
                                </button>
                              ))}
                            </div>
                            {filteredObjects.length === 0 ? (
                              <p className="text-[13px] text-[--foreground-dim] py-2 text-center">No objects match your search</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-1.5">
                                {filteredObjects.map(obj => {
                                  const ObjIcon = OBJECT_ICONS[obj.id] || Package;
                                  const isActive = config.object === obj.id;
                                  return (
                                    <button key={obj.id}
                                      onClick={() => setConfig(prev => ({ ...prev, object: obj.id as ObjectType, objectDetails: getObjectDefaults(obj.id as ObjectType) }))}
                                      className={cn(
                                        "flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all text-[12px] font-medium",
                                        isActive ? "border-[--accent] bg-[--accent-subtle] text-[--accent] ring-1 ring-[--accent]/30" : "border-[--border] hover:border-[--border-accent] bg-[--bg-surface] text-[--foreground-muted] hover:text-[--foreground]"
                                      )}>
                                      <ObjIcon size={12} strokeWidth={2} />
                                      <span className="truncate">{obj.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Object Details (+ Material for print) ── */}
                        {section.id === 'object-details' && (
                          <div className="space-y-4">
                            {(OBJECT_OPTIONS[config.object] ?? []).map(opt => (
                              <div key={opt.key} className="space-y-1.5">
                                <label className="text-[10px] font-bold tracking-widest text-[--foreground-dim] uppercase">{opt.label}</label>
                                <div className={cn("grid gap-1.5", opt.choices.length <= 3 ? "grid-cols-3" : "grid-cols-2")}>
                                  {opt.choices.map(choice => (
                                    <TogglePill key={choice.id} label={choice.label}
                                      active={(config.objectDetails[opt.key] ?? opt.default) === choice.id}
                                      onClick={() => setConfig(prev => ({ ...prev, objectDetails: { ...prev.objectDetails, [opt.key]: choice.id } }))} />
                                  ))}
                                </div>
                              </div>
                            ))}
                            {isPrintObject && (
                              <div className="space-y-1.5 pt-2 border-t border-[--border]">
                                <label className="text-[10px] font-bold tracking-widest text-[--foreground-dim] uppercase">Material Finish</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {MATERIALS.map(mat => (
                                    <TogglePill key={mat.id} label={mat.label} active={config.material === mat.id}
                                      onClick={() => setConfig(prev => ({ ...prev, material: mat.id as MaterialType }))} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Asset Input ── */}
                        {section.id === 'asset-input' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 gap-1.5">
                              {ASSET_INPUTS.map(ai => (
                                <TogglePill key={ai.id} label={ai.label} active={config.assetInput === ai.id}
                                  onClick={() => setConfig(prev => ({ ...prev, assetInput: ai.id as AssetInputType }))} />
                              ))}
                            </div>
                            {config.assetInput === 'design-custom' && (
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold tracking-widest text-[--foreground-dim] uppercase">Dimensions</label>
                                <input type="text" value={config.assetDimensions}
                                  onChange={e => setConfig(prev => ({ ...prev, assetDimensions: e.target.value }))}
                                  placeholder="e.g. 1920x1080px, A4, 210x297mm"
                                  className="w-full p-2.5 text-[13px] bg-[--bg-inset] border border-[--border] rounded-lg focus:outline-none focus:ring-1 focus:ring-[--accent-dim] text-[--foreground] placeholder:text-[--foreground-dim]" />
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Camera Angle ── */}
                        {section.id === 'camera' && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-1.5">
                              {CAMERAS.map(cam => (
                                <TogglePill key={cam.id} label={cam.label} active={config.camera === cam.id}
                                  onClick={() => setConfig(prev => ({
                                    ...prev, camera: cam.id as CameraAngle,
                                    customAngle: cam.id === 'custom' ? (prev.customAngle || { pitch: 30, yaw: 30 }) : prev.customAngle,
                                  }))} />
                              ))}
                            </div>
                            {config.camera === 'custom' && (
                              <AngleWidget angle={config.customAngle || { pitch: 30, yaw: 30 }}
                                onChange={a => setConfig(prev => ({ ...prev, customAngle: a }))} />
                            )}
                          </div>
                        )}

                        {/* ── Surface ── */}
                        {section.id === 'surface' && (
                          <div className="grid grid-cols-2 gap-1.5">
                            {SURFACES.map(srf => (
                              <TogglePill key={srf.id} label={srf.label} active={config.surface === srf.id}
                                onClick={() => setConfig(prev => ({ ...prev, surface: srf.id as SurfaceType }))} />
                            ))}
                          </div>
                        )}

                        {/* ── Setting ── */}
                        {section.id === 'setting' && (
                          <div className="grid grid-cols-2 gap-1.5">
                            {SETTINGS.map(s => (
                              <TogglePill key={s.id} label={s.label} active={config.setting === s.id}
                                onClick={() => setConfig(prev => ({ ...prev, setting: s.id as SettingType }))} />
                            ))}
                          </div>
                        )}

                        {/* ── Lighting ── */}
                        {section.id === 'lighting' && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-1.5">
                              {LIGHTINGS.map(lt => (
                                <TogglePill key={lt.id} label={lt.label} active={config.lighting === lt.id}
                                  onClick={() => setConfig(prev => ({ ...prev, lighting: lt.id as LightingType }))} />
                              ))}
                            </div>
                            <div className="space-y-2 pt-1">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold tracking-widest text-[--foreground-dim] uppercase">Intensity</label>
                                <span className="text-[13px] font-mono font-bold text-[--accent]">{config.intensity}%</span>
                              </div>
                              <input type="range" min="0" max="100" value={config.intensity}
                                onChange={e => setConfig(prev => ({ ...prev, intensity: parseInt(e.target.value) }))}
                                className="w-full cursor-pointer" />
                            </div>
                          </div>
                        )}

                        {/* ── Colors ── */}
                        {section.id === 'colors' && <ColorSwatchesUI />}

                        {/* ── Props ── */}
                        {section.id === 'props' && (
                          <div className="space-y-2">
                            <p className="text-[11px] text-[--foreground-dim]">Multi-select. Props appear near the hero object.</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {PROPS.map(p => (
                                <TogglePill key={p.id} label={p.label} active={config.props.includes(p.id as PropType)}
                                  onClick={() => toggleProp(p.id as PropType)} />
                              ))}
                            </div>
                            {config.props.length > 0 && (
                              <button onClick={() => setConfig(prev => ({ ...prev, props: [] }))}
                                className="text-[12px] font-bold text-[--foreground-dim] hover:text-[--accent] transition-colors flex items-center gap-1 pt-1">
                                <RotateCcw size={10} /> Clear all
                              </button>
                            )}
                          </div>
                        )}

                        {/* ── Hand ── */}
                        {section.id === 'hand' && (
                          <div className="grid grid-cols-2 gap-1.5">
                            {HANDS.map(h => (
                              <TogglePill key={h.id} label={h.label} active={config.hand === h.id}
                                onClick={() => setConfig(prev => ({ ...prev, hand: h.id as HandMode }))} />
                            ))}
                          </div>
                        )}

                        {/* ── Screen Effects ── */}
                        {section.id === 'screen-fx' && (
                          <div className="space-y-2">
                            <p className="text-[11px] text-[--foreground-dim]">Adds realism to screen mockups. Multi-select.</p>
                            <div className="grid grid-cols-1 gap-1.5">
                              {SCREEN_EFFECTS.map(fx => (
                                <TogglePill key={fx.id} label={fx.label} active={config.screenEffects.includes(fx.id as ScreenEffectType)}
                                  onClick={() => toggleScreenEffect(fx.id as ScreenEffectType)} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ── Imperfections ── */}
                        {section.id === 'imperfections' && (
                          <div className="space-y-2">
                            <p className="text-[11px] text-[--foreground-dim]">Ultra-subtle details for photographic realism.</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {availableImperfections.map(imp => (
                                <TogglePill key={imp.id} label={imp.label} active={config.imperfections.includes(imp.id as ImperfectionType)}
                                  onClick={() => toggleImperfection(imp.id as ImperfectionType)} />
                              ))}
                            </div>
                            {config.imperfections.length > 0 && (
                              <button onClick={() => setConfig(prev => ({ ...prev, imperfections: [] }))}
                                className="text-[12px] font-bold text-[--foreground-dim] hover:text-[--accent] transition-colors flex items-center gap-1 pt-1">
                                <RotateCcw size={10} /> Clear all
                              </button>
                            )}
                          </div>
                        )}

                        {/* ── Infinite Background ── */}
                        {section.id === 'infinite-bg' && (
                          <div className="space-y-3">
                            <button onClick={() => setConfig(prev => ({ ...prev, infiniteBackground: !prev.infiniteBackground }))}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-[13px] font-medium",
                                config.infiniteBackground
                                  ? "border-[--accent] bg-[--accent-subtle] text-[--accent] ring-1 ring-[--accent]/30"
                                  : "border-[--border] hover:border-[--border-accent] bg-[--bg-surface] text-[--foreground-muted]"
                              )}>
                              <span>{config.infiniteBackground ? 'Infinite BG: ON' : 'Infinite BG: OFF'}</span>
                              <div className={cn("w-8 h-4 rounded-full transition-colors relative", config.infiniteBackground ? "bg-[--bg-base]/30" : "bg-[--border-light]")}>
                                <div className={cn("absolute top-0.5 w-3 h-3 rounded-full shadow-sm transition-transform", config.infiniteBackground ? "translate-x-4 bg-[--bg-base]" : "translate-x-0.5 bg-[--foreground]")} />
                              </div>
                            </button>
                            {config.infiniteBackground && (
                              <div className="space-y-2.5">
                                <label className="text-[10px] font-bold tracking-widest text-[--foreground-dim] uppercase">Background Color</label>
                                <div className="flex items-center gap-3">
                                  <input type="color" value={config.infiniteBgColor}
                                    onChange={e => setConfig(prev => ({ ...prev, infiniteBgColor: e.target.value }))}
                                    className="w-10 h-10 rounded-lg border border-[--border] cursor-pointer p-0.5 bg-transparent" />
                                  <input type="text" value={config.infiniteBgColor}
                                    onChange={e => setConfig(prev => ({ ...prev, infiniteBgColor: e.target.value }))}
                                    className="flex-1 p-2.5 text-[13px] font-mono bg-[--bg-inset] border border-[--border] rounded-lg focus:outline-none focus:ring-1 focus:ring-[--accent-dim] text-[--foreground]" />
                                </div>
                                {config.swatchColors.length > 0 && (
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold tracking-widest text-[--foreground-dim] uppercase">From your palette</label>
                                    <div className="flex items-center gap-2">
                                      {config.swatchColors.map((color, i) => (
                                        <button key={i}
                                          onClick={() => setConfig(prev => ({ ...prev, infiniteBgColor: color }))}
                                          className={cn("w-8 h-8 rounded-lg border-2 transition-all hover:scale-110", config.infiniteBgColor === color ? "border-[--accent] ring-1 ring-[--accent]" : "border-[--border]")}
                                          style={{ backgroundColor: color }} title={color} />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Brand Details ── */}
                        {section.id === 'brand' && (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold tracking-widest text-[--foreground-dim] uppercase">Asset Description</label>
                              <textarea value={config.assetDescription}
                                onChange={e => setConfig(prev => ({ ...prev, assetDescription: e.target.value }))}
                                placeholder="e.g. A minimalist serif logo for a boutique hotel, embossed in dark olive green..."
                                className="w-full h-20 p-2.5 text-[13px] bg-[--bg-inset] border border-[--border] rounded-lg focus:outline-none focus:ring-1 focus:ring-[--accent-dim] resize-none text-[--foreground] placeholder:text-[--foreground-dim]" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold tracking-widest text-[--foreground-dim] uppercase">Color Palette</label>
                              <input type="text" value={config.colorPalette}
                                onChange={e => setConfig(prev => ({ ...prev, colorPalette: e.target.value }))}
                                className="w-full p-2.5 text-[13px] bg-[--bg-inset] border border-[--border] rounded-lg focus:outline-none focus:ring-1 focus:ring-[--accent-dim] text-[--foreground] placeholder:text-[--foreground-dim]"
                                placeholder="Warm neutrals, off-whites..." />
                            </div>
                          </div>
                        )}

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );

  return (
    <main className="flex min-h-screen bg-[--bg-base] text-[--foreground]" style={{ fontFamily: SYSTEM_FONT }}>

      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "w-[340px] min-w-[340px] border-r border-[--border] bg-[--bg-raised] flex flex-col h-screen",
        "md:sticky md:top-0",
        "fixed top-0 left-0 z-40 transition-transform duration-300 md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <StudioSidebar />
      </aside>

      {/* Canvas */}
      <section className="flex-1 flex flex-col min-h-screen relative">
        {/* Top bar */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-[--bg-base]/80 border-b border-[--border] px-4 md:px-8 py-3">
          <div className="flex items-center justify-between gap-3">
            <button className="md:hidden text-[--foreground-muted] hover:text-[--foreground] p-1 shrink-0" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>

            <div className="hidden md:flex items-center gap-2 text-[12px] font-medium text-[--foreground-dim] min-w-0">
              <span className="text-[--foreground-muted] truncate">{label(OBJECTS, config.object)}</span>
              <CircleDot size={4} className="text-[--foreground-dim] shrink-0" />
              <span className="truncate">{config.camera === 'custom' ? 'Custom 3D' : label(CAMERAS, config.camera)}</span>
              <CircleDot size={4} className="text-[--foreground-dim] shrink-0" />
              <span className="truncate">{label(LIGHTINGS, config.lighting)}</span>
              <CircleDot size={4} className="text-[--foreground-dim] shrink-0" />
              <span>{config.imageRatio}</span>
            </div>

            <div className="flex items-center gap-2 md:gap-3 ml-auto">
              <div className="hidden md:flex items-center gap-1.5 text-[12px] text-[--foreground-dim]">
                <Hash size={11} />
                <span className="font-mono">{wordCount} words</span>
              </div>

              <ModeSwitcher compact />

              <div className="flex items-center rounded-lg border border-[--border] overflow-hidden bg-[--bg-surface]">
                <button onClick={() => setCopyFormat('text')}
                  className={cn("px-2.5 py-1.5 text-[11px] font-bold transition-all", copyFormat === 'text' ? "bg-[--accent-subtle] text-[--accent] border-[--accent]" : "text-[--foreground-dim] hover:text-[--foreground]")}>
                  Text
                </button>
                <button onClick={() => setCopyFormat('json')}
                  className={cn("px-2.5 py-1.5 text-[11px] font-bold transition-all flex items-center gap-1", copyFormat === 'json' ? "bg-[--accent-subtle] text-[--accent] border-[--accent]" : "text-[--foreground-dim] hover:text-[--foreground]")}>
                  <Braces size={11} /> JSON
                </button>
              </div>

              <button onClick={handleCopy}
                className={cn(
                  "flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-[13px] font-bold transition-all",
                  copied
                    ? "bg-[--success]/20 text-[--success] border border-[--success]/30"
                    : "bg-[--accent]/90 text-[--bg-base] hover:bg-[--accent] shadow-sm"
                )}>
                {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /><span className="hidden sm:inline"> Copy {copyFormat === 'json' ? 'JSON' : 'Prompt'}</span></>}
              </button>
            </div>
          </div>
        </header>

        {/* Canvas content */}
        <div className="flex-1 flex items-start justify-center p-4 md:p-8 overflow-y-auto">
          <div className="w-full max-w-4xl">
            {/* Config summary pills */}
            <div className="flex flex-wrap gap-1.5 mb-6">
              {summaryPills.map(pill => (
                <button key={pill.k}
                  onClick={() => resetPillValue(pill.k)}
                  className="group flex items-center gap-1.5 px-2.5 py-1 bg-[--bg-surface] border border-[--border] rounded-full hover:border-[--accent-dim] hover:bg-[--accent-subtle] transition-all">
                  <span className="text-[10px] font-bold text-[--foreground-dim] uppercase">{pill.k}</span>
                  <span className="text-[12px] font-semibold text-[--foreground-muted]">{pill.v}</span>
                  <X size={9} className="text-[--foreground-dim] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              {config.swatchColors.length > 0 && (
                <button
                  onClick={() => setConfig(prev => ({ ...prev, swatchColors: [] }))}
                  className="group flex items-center gap-1 px-2.5 py-1 bg-[--bg-surface] border border-[--border] rounded-full hover:border-[--accent-dim] hover:bg-[--accent-subtle] transition-all">
                  {config.swatchColors.map((c, i) => (
                    <div key={i} className="w-3.5 h-3.5 rounded-full border border-[--border-light]" style={{ backgroundColor: c }} />
                  ))}
                  <X size={9} className="text-[--foreground-dim] opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                </button>
              )}
            </div>

            <PromptCanvas />
          </div>
        </div>

        {/* Footer */}
        <footer className="px-4 md:px-8 py-4 border-t border-[--border] flex items-center justify-between gap-4">
          <p className="text-[11px] font-bold text-[--foreground-dim] tracking-widest uppercase">
            Built for design consistency by Benjamin Arnedo
          </p>
          <p className="text-[11px] text-[--foreground-dim]/50 font-medium hidden md:block">
            {OBJECTS.length} objects &middot; {CAMERAS.length} angles &middot; {SURFACES.length} surfaces &middot; {LIGHTINGS.length} lights
          </p>
        </footer>
      </section>
    </main>
  );
}
