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
  Search, Menu, Braces, Mail, ArrowRight, ArrowLeft,
  Layers2, Settings2, LayoutGrid,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  OBJECTS, CAMERAS, SURFACES, SETTINGS, LIGHTINGS, MATERIALS,
  IMAGE_RATIOS, ASSET_INPUTS, ASSET_RATIOS, PROPS, HANDS, SCREEN_EFFECTS,
  IMPERFECTIONS_UNIVERSAL, IMPERFECTIONS_SCREEN, IMPERFECTIONS_FABRIC,
  IMPERFECTIONS_PRINT, IMPERFECTIONS_HARD,
  PRINT_OBJECTS, FABRIC_OBJECTS, SCREEN_OBJECTS, SIGNAGE_OBJECTS,
  OBJECT_OPTIONS, getObjectDefaults,
  MockupConfig, ObjectType, CameraAngle, SurfaceType, SettingType,
  LightingType, MaterialType, ImageRatio, AssetInputType, AssetRatioType, PropType,
  HandMode, ScreenEffectType, ImperfectionType, CustomAngle,
} from '@/types/mockup';
import { generateMockupPrompt, type StructuredPrompt } from '@/lib/prompt-engine';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

// ── Object icon map ──────────────────────────────────────────────────────────

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

const HARD_OBJECTS: ObjectType[] = ['coffee-mug', 'bottle-label'];

const OBJECT_CATEGORIES = [
  { id: 'all', label: 'All', objects: OBJECTS.map(o => o.id) },
  { id: 'print', label: 'Print', objects: PRINT_OBJECTS },
  { id: 'screen', label: 'Screen', objects: SCREEN_OBJECTS },
  { id: 'fabric', label: 'Fabric', objects: FABRIC_OBJECTS },
  { id: 'signage', label: 'Signage', objects: SIGNAGE_OBJECTS },
  { id: 'hard', label: 'Hard', objects: HARD_OBJECTS },
] as const;

// ── 3D Math helpers ──────────────────────────────────────────────────────────

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

// ── 3D Angle Gizmo ───────────────────────────────────────────────────────────

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
    { verts: [0, 1, 2, 3], nz: -1, color: '#1A1D28', label: '',      isFront: false },
    { verts: [5, 4, 7, 6], nz:  1, color: '#6366F1', label: 'front', isFront: true },
    { verts: [4, 0, 3, 7], nz:  0, color: '#222535', label: '',      isFront: false },
    { verts: [1, 5, 6, 2], nz:  0, color: '#222535', label: '',      isFront: false },
    { verts: [4, 5, 1, 0], nz:  0, color: '#2A2E3F', label: '',      isFront: false },
    { verts: [3, 2, 6, 7], nz:  0, color: '#1A1D28', label: '',      isFront: false },
  ].map(face => {
    const pts = face.verts.map(i => slabVerts[i]);
    const ax = pts[1].x - pts[0].x, ay = pts[1].y - pts[0].y;
    const bx = pts[2].x - pts[0].x, by = pts[2].y - pts[0].y;
    const nz = ax * by - ay * bx;
    return { ...face, pts, visible: nz < 0, avgZ: pts.reduce((s, p) => s + p.z, 0) / 4 };
  }).filter(f => f.visible).sort((a, b) => b.avgZ - a.avgZ);

  const avgZ = (ring: { z: number }[]) => ring.reduce((s, p) => s + p.z, 0) / ring.length;
  const rings: { axis: DragAxis; points: typeof xRing; color: string; hoverColor: string; label: string; end: typeof xEnd }[] = [
    { axis: 'x', points: xRing, color: '#F87171', hoverColor: '#FCA5A5', label: 'X', end: xEnd },
    { axis: 'y', points: yRing, color: '#4ADE80', hoverColor: '#86EFAC', label: 'Y', end: yEnd },
    { axis: 'z', points: zRing, color: '#818CF8', hoverColor: '#A5B4FC', label: 'Z', end: zEnd },
  ];
  rings.sort((a, b) => avgZ(a.points) - avgZ(b.points));

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border border-gray-700 overflow-hidden select-none bg-gray-950"
        style={{ cursor: hovered ? 'grab' : 'default' }}>
        <svg ref={svgRef} viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp} onPointerLeave={handlePointerLeave}>
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={SIZE} height={SIZE} fill="url(#grid)" />
          <circle cx={CX} cy={CY} r={RADIUS + 8}
            fill="none" stroke={hovered === 'trackball' ? 'rgba(129,140,248,0.4)' : 'rgba(255,255,255,0.06)'}
            strokeWidth={hovered === 'trackball' ? 2.5 : 1.5}
            strokeDasharray="4 3" opacity={hovered === 'trackball' ? 1 : 0.6} />
          <line x1={CX - 6} y1={CY} x2={CX + 6} y2={CY} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
          <line x1={CX} y1={CY - 6} x2={CX} y2={CY + 6} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
          {slabFaces.map((face, i) => {
            const d = face.pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ') + ' Z';
            const cx = face.pts.reduce((s, p) => s + p.sx, 0) / 4;
            const cy = face.pts.reduce((s, p) => s + p.sy, 0) / 4;
            return (
              <g key={`face-${i}`}>
                <path d={d} fill={face.color} stroke="rgba(129,140,248,0.15)" strokeWidth="0.5" opacity={0.9} />
                {face.isFront && (
                  <>
                    <path d={(() => {
                      const inset = 0.15;
                      return face.pts.map((p, j) => {
                        const nx = cx + (p.sx - cx) * (1 - inset);
                        const ny = cy + (p.sy - cy) * (1 - inset);
                        return `${j === 0 ? 'M' : 'L'}${nx.toFixed(1)},${ny.toFixed(1)}`;
                      }).join(' ') + ' Z';
                    })()} fill="none" stroke="rgba(165,180,252,0.4)" strokeWidth="0.8" />
                    <circle cx={cx} cy={cy} r={2} fill="#A5B4FC" opacity={0.5} />
                    <text x={cx} y={cy + 6} textAnchor="middle" dominantBaseline="central"
                      fill="white" fontSize="7" fontWeight="bold" fontFamily="monospace" opacity={0.6}>FRONT</text>
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
                <path d={backPath.join(' ')} fill="none" stroke={c} strokeWidth={isActive ? 2.5 : 1.5} opacity={0.15} strokeLinecap="round" />
                <path d={frontPath.join(' ')} fill="none" stroke={c} strokeWidth={isActive ? 3 : 2} opacity={isActive ? 1 : 0.55} strokeLinecap="round" />
                <circle cx={CX + end.x} cy={CY - end.y} r={isActive ? 9 : 7} fill={c} opacity={isActive ? 0.9 : 0.45} />
                <text x={CX + end.x} y={CY - end.y + 1} textAnchor="middle" dominantBaseline="central"
                  fill="white" fontSize="8" fontWeight="bold" fontFamily="monospace">{axLabel}</text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={2.5} fill="rgba(255,255,255,0.2)" />
          <text x={12} y={SIZE - 8} fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="monospace">
            <tspan fill="#F87171">X</tspan>=Pitch <tspan fill="#4ADE80">Y</tspan>=Yaw <tspan fill="#818CF8">Z</tspan>=Free
          </text>
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-950 rounded-lg px-3 py-2 border border-gray-700/50">
          <span className="text-[11px] font-bold text-[#F87171] uppercase block">Pitch (X)</span>
          <span className="text-[13px] font-mono font-bold text-gray-100">{Math.round(angle.pitch)}° <span className="text-gray-500 text-[11px]">{pitchLabel}</span></span>
        </div>
        <div className="bg-gray-950 rounded-lg px-3 py-2 border border-gray-700/50">
          <span className="text-[11px] font-bold text-[#4ADE80] uppercase block">Yaw (Y)</span>
          <span className="text-[13px] font-mono font-bold text-gray-100">{Math.round(angle.yaw)}° <span className="text-gray-500 text-[11px]">{yawLabel}</span></span>
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
            className="text-[11px] font-bold text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all py-1.5 rounded-lg border border-gray-700/50 bg-gray-800">
            {pre.label}
          </button>
        ))}
      </div>
      <button onClick={() => onChange({ pitch: 30, yaw: 30 })}
        className="w-full flex items-center justify-center gap-1.5 text-[12px] font-medium text-gray-500 hover:text-indigo-400 transition-colors py-1">
        <RotateCcw size={10} /> Reset
      </button>
    </div>
  );
}

// ── Toggle Pill ──────────────────────────────────────────────────────────────

function TogglePill({ label, active, onClick, icon: Icon }: {
  label: string; active: boolean; onClick: () => void; icon?: React.ElementType;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "px-4 py-2.5 rounded-xl border text-sm transition-all duration-200 flex items-center gap-1.5 justify-center",
        active
          ? "border-indigo-400 bg-indigo-500/10 text-indigo-400 font-medium"
          : "border-gray-700/50 bg-gray-800 text-gray-400 hover:border-gray-700 hover:bg-gray-700 hover:text-gray-100"
      )}>
      {Icon && <Icon size={12} strokeWidth={2} />}
      {label}
    </button>
  );
}

// ── Color Swatches UI ────────────────────────────────────────────────────────

function ColorSwatchesUI({ colors, onUpdate, onRemove, onAdd, onClear, onExtract, extracting, fileInputRef }: {
  colors: string[];
  onUpdate: (i: number, hex: string) => void;
  onRemove: (i: number) => void;
  onAdd: (hex: string) => void;
  onClear: () => void;
  onExtract: (e: React.ChangeEvent<HTMLInputElement>) => void;
  extracting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {colors.map((color, i) => (
          <div key={i} className="relative group">
            <label className="block w-11 h-11 rounded-xl border-2 border-gray-700/50 cursor-pointer overflow-hidden hover:border-indigo-400 transition-colors"
              style={{ backgroundColor: color }}>
              <input type="color" value={color}
                onChange={e => onUpdate(i, e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
            </label>
            <button onClick={() => onRemove(i)} aria-label="Remove color"
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-400 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X size={8} strokeWidth={3} />
            </button>
            <span className="block text-[9px] font-mono text-gray-500 text-center mt-1 leading-none">{color}</span>
          </div>
        ))}
        {colors.length < 5 && (
          <label className="relative w-11 h-11 rounded-xl border-2 border-dashed border-gray-700/50 cursor-pointer flex items-center justify-center hover:border-indigo-400 transition-colors">
            <Plus size={14} className="text-gray-500" />
            <input type="color" value="#818CF8"
              onChange={e => onAdd(e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
          </label>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onExtract} className="hidden" />
      <button onClick={() => fileInputRef.current?.click()} disabled={extracting}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-700/50 text-sm font-medium transition-all duration-200 bg-gray-800 text-gray-400 hover:border-gray-700 hover:bg-gray-700">
        {extracting ? (
          <><div className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /><span>Extracting\u2026</span></>
        ) : (
          <><ImagePlus size={14} /><span>Extract from Image</span></>
        )}
      </button>
      <p className="text-[11px] text-gray-500">100% local — never uploaded.</p>
      {colors.length > 0 && (
        <button onClick={onClear}
          className="text-[12px] font-medium text-gray-500 hover:text-indigo-400 transition-colors flex items-center gap-1">
          <RotateCcw size={10} /> Clear colors
        </button>
      )}
    </div>
  );
}

// ── Mode Switcher ────────────────────────────────────────────────────────────

function ModeSwitcher({ compact = false, uiMode, onWizard, onStudio }: {
  compact?: boolean;
  uiMode: 'wizard' | 'studio';
  onWizard: () => void;
  onStudio: () => void;
}) {
  return (
    <div className={cn(
      "flex items-center rounded-xl border border-gray-700/50 overflow-hidden bg-gray-800",
      compact && "text-[12px]"
    )}>
      <button
        onClick={onWizard}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 transition-all duration-200 font-semibold",
          compact ? "text-[11px] px-2.5 py-1.5" : "text-[13px]",
          uiMode === 'wizard'
            ? "bg-indigo-500/10 text-indigo-400"
            : "text-gray-500 hover:text-gray-100"
        )}>
        <Wand2 size={compact ? 11 : 13} />
        {!compact && 'Wizard'}
      </button>
      <button
        onClick={onStudio}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 transition-all duration-200 font-semibold",
          compact ? "text-[11px] px-2.5 py-1.5" : "text-[13px]",
          uiMode === 'studio'
            ? "bg-indigo-500/10 text-indigo-400"
            : "text-gray-500 hover:text-gray-100"
        )}>
        <LayoutGrid size={compact ? 11 : 13} />
        {!compact && 'Studio'}
      </button>
    </div>
  );
}

// ── Prompt Preview Panel ─────────────────────────────────────────────────────

function PromptPreview({ maxH = '70vh', segments, wordCount, completeness, copyFormat, setCopyFormat, onCopy, copied }: {
  maxH?: string;
  segments: { label: string; text: string }[];
  wordCount: number;
  completeness: { score: number; label: string };
  copyFormat: 'text' | 'json';
  setCopyFormat: (f: 'text' | 'json') => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-700/50 bg-gray-800 overflow-hidden flex flex-col" style={{ maxHeight: maxH }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-700/50 flex items-center gap-2.5 shrink-0">
        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span className="text-xs font-semibold text-indigo-400 tracking-wide">Live Prompt</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-mono", wordCount > 500 ? "text-amber-400" : "text-gray-500")}>
            {wordCount}w
            {wordCount > 500 && <span className="text-[9px] ml-1" title="Most AI image tools truncate long prompts. Midjourney: ~60 words, DALL-E: ~400 chars.">long</span>}
          </span>
          <div className="flex gap-1">
            {['8K', 'UE5'].map(tag => (
              <span key={tag} className="px-1.5 py-0.5 bg-gray-950 text-[9px] font-bold text-gray-500 rounded-md border border-gray-700/50 uppercase tracking-wider">{tag}</span>
            ))}
          </div>
        </div>
      </div>
      {/* Completeness bar */}
      <div className="px-5 py-2 border-b border-gray-700/50 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Richness</span>
          <span className="text-xs font-semibold text-indigo-400">{completeness.label} · {completeness.score}%</span>
        </div>
        <div className="h-1 bg-gray-950 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
            animate={{ width: `${completeness.score}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>
      {/* Segments */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
        {segments.map((seg, i) => (
          <div key={i}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 block mb-1.5">{seg.label}</span>
            <p className="text-[13px] leading-relaxed text-gray-400">{seg.text}</p>
          </div>
        ))}
      </div>
      {/* Copy footer */}
      <div className="p-4 border-t border-gray-700/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-gray-700/50 overflow-hidden bg-gray-950 text-[11px]">
            <button onClick={() => setCopyFormat('text')}
              className={cn("px-3 py-1.5 font-bold transition-all duration-200", copyFormat === 'text' ? "bg-indigo-500/10 text-indigo-400" : "text-gray-500 hover:text-gray-100")}>
              Text
            </button>
            <button onClick={() => setCopyFormat('json')}
              className={cn("px-3 py-1.5 font-bold transition-all duration-200 flex items-center gap-1", copyFormat === 'json' ? "bg-indigo-500/10 text-indigo-400" : "text-gray-500 hover:text-gray-100")}>
              <Braces size={10} /> JSON
            </button>
          </div>
          <button onClick={onCopy}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
              copied
                ? "bg-green-400/15 text-green-400 border border-green-400/25"
                : "bg-indigo-500 text-white hover:bg-indigo-400"
            )}>
            {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Color extraction ─────────────────────────────────────────────────────────

function extractColorsFromImage(file: File, count: number): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve([]);
    };
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 150;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve([]); URL.revokeObjectURL(img.src); return; }
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

// ── Section definitions ──────────────────────────────────────────────────────

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

// Studio tabs grouping
type StudioTabId = 'object' | 'camera' | 'scene' | 'lighting' | 'style' | 'extras';
const STUDIO_TABS: { id: StudioTabId; label: string; icon: React.ElementType }[] = [
  { id: 'object',   label: 'Object',   icon: Package },
  { id: 'camera',   label: 'Camera',   icon: Camera },
  { id: 'scene',    label: 'Scene',    icon: Sun },
  { id: 'lighting', label: 'Lighting', icon: Eye },
  { id: 'style',    label: 'Input',    icon: FileImage },
  { id: 'extras',   label: 'Extras',   icon: Zap },
];

// ── Prompt quality score ─────────────────────────────────────────────────────

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

// ── Aspect ratio map ─────────────────────────────────────────────────────────

const RATIO_DIMENSIONS: Record<string, { w: number; h: number }> = {
  '1:1': { w: 1, h: 1 }, '4:5': { w: 4, h: 5 }, '4:3': { w: 4, h: 3 },
  '3:2': { w: 3, h: 2 }, '16:9': { w: 16, h: 9 }, '21:9': { w: 21, h: 9 },
  '9:16': { w: 9, h: 16 }, '2:3': { w: 2, h: 3 },
};

// ── Default config ───────────────────────────────────────────────────────────

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
  assetRatio: 'auto',
  customAssetRatio: '',
  assetDimensions: '',
  props: [],
  hand: 'none',
  screenEffects: [],
  imperfections: [],
  infiniteBackground: false,
  infiniteBgColor: '#ffffff',
};

// ── URL state encoding (delta-compressed) ───────────────────────────────────

function configToHash(config: MockupConfig): string {
  // Only encode fields that differ from defaults (delta encoding)
  const delta: Record<string, unknown> = {};
  const d = DEFAULT_CONFIG;
  if (config.object !== d.object) delta.o = config.object;
  if (config.camera !== d.camera) delta.c = config.camera;
  if (config.customAngle) delta.ca = config.customAngle;
  if (config.surface !== d.surface) delta.s = config.surface;
  if (config.setting !== d.setting) delta.st = config.setting;
  if (config.lighting !== d.lighting) delta.l = config.lighting;
  if (config.intensity !== d.intensity) delta.i = config.intensity;
  if (config.material !== d.material) delta.m = config.material;
  if (config.imageRatio !== d.imageRatio) delta.r = config.imageRatio;
  if (config.assetInput !== d.assetInput) delta.ai = config.assetInput;
  if (config.assetRatio !== d.assetRatio) delta.ar = config.assetRatio;
  if (config.customAssetRatio) delta.car = config.customAssetRatio;
  if (config.assetDimensions) delta.ad = config.assetDimensions;
  if (config.assetDescription) delta.desc = config.assetDescription;
  if (config.colorPalette !== d.colorPalette) delta.cp = config.colorPalette;
  if (config.swatchColors.length > 0) delta.sw = config.swatchColors;
  if (config.props.length > 0) delta.p = config.props;
  if (config.hand !== d.hand) delta.h = config.hand;
  if (config.screenEffects.length > 0) delta.fx = config.screenEffects;
  if (config.imperfections.length > 0) delta.imp = config.imperfections;
  if (config.infiniteBackground) delta.ib = true;
  if (config.infiniteBgColor !== d.infiniteBgColor) delta.ibc = config.infiniteBgColor;
  // Object details: only store non-default values
  const objDefs = OBJECT_OPTIONS[config.object] ?? [];
  const detailDelta: Record<string, string> = {};
  for (const def of objDefs) {
    const val = config.objectDetails[def.key];
    if (val && val !== def.default) detailDelta[def.key] = val;
  }
  if (Object.keys(detailDelta).length > 0) delta.od = detailDelta;

  if (Object.keys(delta).length === 0) return '';
  try {
    return btoa(JSON.stringify(delta));
  } catch {
    return '';
  }
}

function hashToConfig(hash: string): MockupConfig | null {
  if (!hash) return null;
  try {
    const delta = JSON.parse(atob(hash));
    if (typeof delta !== 'object' || delta === null) return null;
    const obj = (delta.o ?? DEFAULT_CONFIG.object) as ObjectType;
    const baseDetails = getObjectDefaults(obj);
    const detailDelta = delta.od as Record<string, string> | undefined;
    const objectDetails = detailDelta ? { ...baseDetails, ...detailDelta } : baseDetails;
    return {
      ...DEFAULT_CONFIG,
      object: obj,
      objectDetails,
      camera: delta.c ?? DEFAULT_CONFIG.camera,
      customAngle: delta.ca ?? null,
      surface: delta.s ?? DEFAULT_CONFIG.surface,
      setting: delta.st ?? DEFAULT_CONFIG.setting,
      lighting: delta.l ?? DEFAULT_CONFIG.lighting,
      intensity: delta.i ?? DEFAULT_CONFIG.intensity,
      material: delta.m ?? DEFAULT_CONFIG.material,
      imageRatio: delta.r ?? DEFAULT_CONFIG.imageRatio,
      assetInput: delta.ai ?? DEFAULT_CONFIG.assetInput,
      assetRatio: delta.ar ?? DEFAULT_CONFIG.assetRatio,
      customAssetRatio: delta.car ?? '',
      assetDimensions: delta.ad ?? '',
      assetDescription: delta.desc ?? '',
      colorPalette: delta.cp ?? DEFAULT_CONFIG.colorPalette,
      swatchColors: delta.sw ?? [],
      props: delta.p ?? [],
      hand: delta.h ?? DEFAULT_CONFIG.hand,
      screenEffects: delta.fx ?? [],
      imperfections: delta.imp ?? [],
      infiniteBackground: delta.ib ?? false,
      infiniteBgColor: delta.ibc ?? DEFAULT_CONFIG.infiniteBgColor,
    };
  } catch {
    return null;
  }
}

// ── Section modified detection ───────────────────────────────────────────────

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

// ── Preset system ────────────────────────────────────────────────────────────

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
    // localStorage full or disabled
  }
}

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

// ── Wizard steps ─────────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { id: 'presets',     title: 'Welcome back!',                subtitle: 'Start fresh or pick a preset to jump right in.',      icon: Sparkles },
  { id: 'object',      title: 'What are we making?',          subtitle: 'Choose the product you want to photograph.',           icon: Package },
  { id: 'details',     title: 'Customize the details.',       subtitle: 'Fine-tune options specific to your object.',           icon: SlidersHorizontal },
  { id: 'camera',      title: 'How should it look?',          subtitle: 'Pick a frame ratio and camera angle.',                 icon: Camera },
  { id: 'environment', title: 'Set the scene.',               subtitle: 'Choose a surface and setting for your shot.',          icon: Sun },
  { id: 'lighting',    title: 'Light it up.',                 subtitle: 'Pick a lighting mood and intensity.',                  icon: Eye },
  { id: 'style',       title: 'Configure your input.',        subtitle: 'Asset type, proportions, colors, and brand.',          icon: FileImage },
  { id: 'extras',      title: 'Add some flair.',              subtitle: 'Optional props, hand, effects and imperfections.',     icon: Zap },
  { id: 'review',      title: 'Your prompt is ready.',        subtitle: 'Copy it and go create something beautiful.',           icon: Check },
] as const;

type WizardStepId = typeof WIZARD_STEPS[number]['id'];

// ── Main Component ────────────────────────────────────────────────────────────

export default function MockupGenerator() {
  const [config, setConfig] = useState<MockupConfig>(DEFAULT_CONFIG);
  const [uiMode, setUiMode] = useState<'wizard' | 'studio'>('wizard');
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardDirection, setWizardDirection] = useState<'forward' | 'back'>('forward');

  // Studio state
  const [studioTab, setStudioTab] = useState<StudioTabId>('object');
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

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

  // Load initial state from URL hash, presets, and preferences
  useEffect(() => {
    setPresets(loadPresets());
    try {
      const saved = localStorage.getItem(UI_MODE_KEY) as 'wizard' | 'studio' | null;
      if (saved === 'wizard' || saved === 'studio') setUiMode(saved);
    } catch { /* ignore */ }
    // Restore config from URL hash
    const hash = window.location.hash.slice(1);
    if (hash) {
      const restored = hashToConfig(hash);
      if (restored) {
        setConfig(restored);
        setWizardStep(1); // Skip presets step when loading from URL
      }
    }
  }, []);

  // Sync URL hash on config change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const hash = configToHash(config);
      const newUrl = hash ? `#${hash}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }, 300);
    return () => clearTimeout(timer);
  }, [config]);

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

  const structuredPrompt = useMemo(() => generateMockupPrompt(config), [config]);
  const generatedPrompt = structuredPrompt.fullText;
  const promptSegments = structuredPrompt.segments;
  const completeness = useMemo(() => getPromptCompleteness(config), [config]);
  const wordCount = useMemo(() => generatedPrompt.split(/\s+/).length, [generatedPrompt]);

  const toggleArrayField = <T,>(field: 'props' | 'screenEffects' | 'imperfections', id: T) => {
    setConfig(prev => {
      const arr = prev[field] as T[];
      return { ...prev, [field]: arr.includes(id) ? arr.filter(v => v !== id) : [...arr, id] };
    });
  };
  const toggleProp = (id: PropType) => toggleArrayField('props', id);
  const toggleScreenEffect = (id: ScreenEffectType) => toggleArrayField('screenEffects', id);
  const toggleImperfection = (id: ImperfectionType) => toggleArrayField('imperfections', id);

  const availableImperfections = useMemo(() => [
    ...IMPERFECTIONS_UNIVERSAL,
    ...(SCREEN_OBJECTS.includes(config.object) ? IMPERFECTIONS_SCREEN : []),
    ...(FABRIC_OBJECTS.includes(config.object) ? IMPERFECTIONS_FABRIC : []),
    ...(PRINT_OBJECTS.includes(config.object) ? IMPERFECTIONS_PRINT : []),
    ...((!SCREEN_OBJECTS.includes(config.object) && !FABRIC_OBJECTS.includes(config.object) && !PRINT_OBJECTS.includes(config.object) && !SIGNAGE_OBJECTS.includes(config.object)) ? IMPERFECTIONS_HARD : []),
  ], [config.object]);

  const handleCopy = async () => {
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
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: textarea copy for browsers that deny clipboard permission
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
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

  const filteredObjects = OBJECTS.filter(o => {
    const catMatch = objectCategoryFilter === 'all'
      ? true
      : OBJECT_CATEGORIES.find(c => c.id === objectCategoryFilter)?.objects.includes(o.id as ObjectType) ?? false;
    const searchMatch = objectSearch.trim() === ''
      ? true
      : o.label.toLowerCase().includes(objectSearch.trim().toLowerCase());
    return catMatch && searchMatch;
  });

  const ratioData = RATIO_DIMENSIONS[config.imageRatio] || { w: 4, h: 3 };

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

  // Shared component props
  const colorSwatchProps = {
    colors: config.swatchColors,
    onUpdate: updateSwatchColor,
    onRemove: removeSwatchColor,
    onAdd: addSwatchColor,
    onClear: () => setConfig(prev => ({ ...prev, swatchColors: [] })),
    onExtract: handleImageExtract,
    extracting,
    fileInputRef,
  };

  const promptPreviewProps = {
    segments: promptSegments,
    wordCount,
    completeness,
    copyFormat,
    setCopyFormat,
    onCopy: handleCopy,
    copied,
  };

  const modeSwitcherProps = {
    uiMode,
    onWizard: () => { setUiMode('wizard'); setWizardStep(0); },
    onStudio: () => setUiMode('studio'),
  };

  // ── Shared section renderers ─────────────────────────────────────────────

  const sectionCls = (compact: boolean): string =>
    compact ? "space-y-3 pt-2 border-t border-gray-700/50" : "rounded-2xl border border-gray-700/50 bg-gray-800 p-5 space-y-4";
  const cardCls = (compact: boolean): string =>
    compact ? "space-y-3" : "rounded-2xl border border-gray-700/50 bg-gray-800 p-5 space-y-4";
  const gapCls = (compact: boolean) => compact ? "gap-1.5" : "gap-2";

  const renderObjectSelector = (compact = false) => (
    <div className="space-y-3">
      <div className="relative">
        <Search size={compact ? 14 : 15} className={cn("absolute top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none", compact ? "left-3.5" : "left-4")} />
        <input type="text" value={objectSearch}
          onChange={e => setObjectSearch(e.target.value)}
          placeholder="Search objects\u2026" autoComplete="off"
          className={cn("w-full text-sm bg-gray-800 border border-gray-700/50 rounded-xl focus:outline-none focus:border-indigo-400 text-gray-100 placeholder:text-gray-500 transition-colors",
            compact ? "pl-10 pr-9 py-2.5 bg-gray-950" : "pl-11 pr-9 py-3")} />
        {objectSearch && (
          <button onClick={() => setObjectSearch('')} aria-label="Clear search" className={cn("absolute top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-100", compact ? "right-3.5" : "right-4")}>
            <X size={compact ? 12 : 13} />
          </button>
        )}
      </div>
      <div className={cn("flex overflow-x-auto pb-1", gapCls(compact))}>
        {OBJECT_CATEGORIES.map(cat => (
          <button key={cat.id}
            onClick={() => setObjectCategoryFilter(cat.id)}
            className={cn(
              "px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border",
              compact ? "py-1 rounded-lg" : "py-1.5",
              objectCategoryFilter === cat.id
                ? "bg-indigo-500/10 text-indigo-400 border-indigo-400"
                : cn("hover:text-gray-100 bg-gray-800 border-gray-700/50", compact ? "text-gray-500 hover:text-gray-400" : "text-gray-400")
            )}>
            {cat.label}
          </button>
        ))}
      </div>
      {filteredObjects.length === 0 ? (
        <p className={cn("text-sm text-center", compact ? "text-gray-500 py-4" : "text-gray-400 py-8")}>No objects match{compact ? '' : ' your search'}</p>
      ) : (
        <div className={cn("grid", compact ? "grid-cols-2 gap-1.5" : "grid-cols-2 sm:grid-cols-3 gap-3")}>
          {filteredObjects.map(obj => {
            const ObjIcon = OBJECT_ICONS[obj.id] || Package;
            const isActive = config.object === obj.id;
            return compact ? (
              <button key={obj.id}
                onClick={() => setConfig(prev => ({ ...prev, object: obj.id as ObjectType, objectDetails: getObjectDefaults(obj.id as ObjectType) }))}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all duration-200 text-sm",
                  isActive
                    ? "border-indigo-400 bg-indigo-500/10 text-indigo-400 font-medium"
                    : "border-gray-700/50 bg-gray-800 text-gray-400 hover:border-gray-700 hover:bg-gray-700 hover:text-gray-100"
                )}>
                <ObjIcon size={13} strokeWidth={2} />
                <span className="truncate text-xs">{obj.label}</span>
              </button>
            ) : (
              <button key={obj.id}
                onClick={() => setConfig(prev => ({ ...prev, object: obj.id as ObjectType, objectDetails: getObjectDefaults(obj.id as ObjectType) }))}
                className={cn(
                  "flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 text-center transition-all duration-200",
                  isActive
                    ? "border-indigo-400 bg-indigo-500/10 text-indigo-400"
                    : "border-gray-700/50 bg-gray-800 text-gray-400 hover:border-gray-700 hover:bg-gray-700 hover:text-gray-100"
                )}>
                <ObjIcon size={22} strokeWidth={1.5} />
                <span className="text-xs font-semibold leading-tight">{obj.label}</span>
                {isActive && <Check size={12} className="text-indigo-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderObjectDetails = (compact = false) => (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {hasObjectDetails && (OBJECT_OPTIONS[config.object] ?? []).map(opt => (
        <div key={opt.key} className={compact ? "space-y-2" : "rounded-2xl border border-gray-700/50 bg-gray-800 p-5 space-y-3"}>
          <label className={cn("font-medium text-gray-400", compact ? "text-xs text-gray-500" : "text-sm")}>{opt.label}</label>
          <div className={cn("grid", gapCls(compact), opt.choices.length <= 3 ? "grid-cols-3" : "grid-cols-2")}>
            {opt.choices.map(choice => (
              <TogglePill key={choice.id} label={choice.label}
                active={(config.objectDetails[opt.key] ?? opt.default) === choice.id}
                onClick={() => setConfig(prev => ({ ...prev, objectDetails: { ...prev.objectDetails, [opt.key]: choice.id } }))} />
            ))}
          </div>
        </div>
      ))}
      {!hasObjectDetails && !compact && (
        <div className="py-10 text-center text-gray-400 text-sm rounded-2xl border border-gray-700/50 bg-gray-800">
          No extra options for {label(OBJECTS, config.object)}.
        </div>
      )}
    </div>
  );

  const renderMaterialFinish = (compact = false) => isPrintObject ? (
    <div className={sectionCls(compact)}>
      <label className={cn("font-medium text-gray-400", compact ? "text-sm" : "text-sm")}>Material Finish</label>
      <div className={cn("grid gap-2", compact ? "grid-cols-2 gap-1.5" : "grid-cols-2 sm:grid-cols-3")}>
        {MATERIALS.map(mat => (
          <TogglePill key={mat.id} label={mat.label} active={config.material === mat.id}
            onClick={() => setConfig(prev => ({ ...prev, material: mat.id as MaterialType }))} />
        ))}
      </div>
    </div>
  ) : null;

  const renderImageRatio = (compact = false) => (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <p className="text-sm font-medium text-gray-400">Image Ratio</p>
      <div className={cn("grid grid-cols-4", gapCls(compact))}>
        {IMAGE_RATIOS.map(r => {
          const rd = RATIO_DIMENSIONS[r.id] || { w: 4, h: 3 };
          const isActive = config.imageRatio === r.id;
          return (
            <button key={r.id}
              onClick={() => setConfig(prev => ({ ...prev, imageRatio: r.id as ImageRatio }))}
              className={cn(
                "flex flex-col items-center gap-2 py-3 px-1 rounded-xl border-2 transition-all duration-200",
                isActive
                  ? "border-indigo-400 bg-indigo-500/10 text-indigo-400"
                  : cn("border-gray-700/50 text-gray-400 hover:border-gray-700", compact ? "bg-gray-800" : "bg-gray-950")
              )}>
              <div className="flex items-center justify-center w-8 h-8">
                <div className={cn("border-2 rounded-sm", isActive ? "border-indigo-400" : "border-gray-500")} style={{
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
  );

  const renderCameraAngle = (compact = false) => (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <p className="text-sm font-medium text-gray-400">Camera Angle</p>
      <div className={cn("grid grid-cols-2", gapCls(compact))}>
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
  );

  const renderLighting = (compact = false) => (
    <div className={compact ? "space-y-5" : "space-y-4"}>
      <div className={cardCls(compact)}>
        <p className="text-sm font-medium text-gray-400">Lighting Style</p>
        <div className={cn("grid grid-cols-2", gapCls(compact))}>
          {LIGHTINGS.map(lt => (
            <TogglePill key={lt.id} label={lt.label} active={config.lighting === lt.id}
              onClick={() => setConfig(prev => ({ ...prev, lighting: lt.id as LightingType }))} />
          ))}
        </div>
      </div>
      <div className={sectionCls(compact)}>
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-gray-400">Intensity</label>
          <span className="text-sm font-mono font-semibold text-indigo-400">{config.intensity}%</span>
        </div>
        <input type="range" min="0" max="100" value={config.intensity}
          onChange={e => setConfig(prev => ({ ...prev, intensity: parseInt(e.target.value) }))}
          className="w-full cursor-pointer" />
      </div>
    </div>
  );

  const renderInfiniteBackground = (compact = false) => (
    <div className={cardCls(compact)}>
      <div className="flex items-center justify-between">
        <label className={cn("font-medium text-gray-400", compact ? "text-sm" : "text-sm")}>Infinite Background</label>
        <button
          role="switch" aria-checked={config.infiniteBackground} aria-label="Infinite background"
          onClick={() => setConfig(prev => ({ ...prev, infiniteBackground: !prev.infiniteBackground }))}
          className={cn(
            "w-10 h-6 rounded-full transition-colors duration-200 relative flex items-center",
            config.infiniteBackground ? "bg-indigo-400" : "bg-gray-700"
          )}>
          <div className={cn(
            "absolute w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            config.infiniteBackground ? "translate-x-5" : "translate-x-0.5"
          )} />
        </button>
      </div>
      {config.infiniteBackground && (
        <div className="flex items-center gap-3">
          <input type="color" value={config.infiniteBgColor}
            onChange={e => setConfig(prev => ({ ...prev, infiniteBgColor: e.target.value }))}
            className={cn("rounded-xl border border-gray-700/50 cursor-pointer p-0.5 bg-transparent", compact ? "w-10 h-10" : "w-11 h-11")} />
          <input type="text" value={config.infiniteBgColor}
            onChange={e => setConfig(prev => ({ ...prev, infiniteBgColor: e.target.value }))}
            className="flex-1 p-2.5 text-sm font-mono bg-gray-950 border border-gray-700/50 rounded-xl focus:outline-none focus:border-indigo-400 text-gray-100 transition-colors" />
        </div>
      )}
      {compact && config.infiniteBackground && config.swatchColors.length > 0 && (
        <div className="flex items-center gap-2">
          {config.swatchColors.map((color, i) => (
            <button key={i}
              onClick={() => setConfig(prev => ({ ...prev, infiniteBgColor: color }))}
              className={cn("w-8 h-8 rounded-xl border-2 transition-all hover:scale-105", config.infiniteBgColor === color ? "border-indigo-400" : "border-gray-700/50")}
              style={{ backgroundColor: color }} />
          ))}
        </div>
      )}
    </div>
  );

  const renderSurfaceSetting = (compact = false) => !config.infiniteBackground ? (
    <>
      <div className={sectionCls(compact)}>
        <p className="text-sm font-medium text-gray-400">Surface</p>
        <div className={cn("grid grid-cols-2", gapCls(compact))}>
          {SURFACES.map(srf => (
            <TogglePill key={srf.id} label={srf.label} active={config.surface === srf.id}
              onClick={() => setConfig(prev => ({ ...prev, surface: srf.id as SurfaceType }))} />
          ))}
        </div>
      </div>
      <div className={sectionCls(compact)}>
        <p className="text-sm font-medium text-gray-400">Setting</p>
        <div className={cn("grid grid-cols-2", gapCls(compact))}>
          {SETTINGS.map(s => (
            <TogglePill key={s.id} label={s.label} active={config.setting === s.id}
              onClick={() => setConfig(prev => ({ ...prev, setting: s.id as SettingType }))} />
          ))}
        </div>
      </div>
    </>
  ) : null;

  const renderAssetInput = (compact = false) => (
    <div className={compact ? "space-y-5" : "space-y-4"}>
      <div className={cardCls(compact)}>
        <p className="text-sm font-medium text-gray-400">Asset Input Type</p>
        <div className={cn("grid grid-cols-1", gapCls(compact))}>
          {ASSET_INPUTS.map(ai => (
            <TogglePill key={ai.id} label={ai.label} active={config.assetInput === ai.id}
              onClick={() => setConfig(prev => ({ ...prev, assetInput: ai.id as AssetInputType }))} />
          ))}
        </div>
        {config.assetInput === 'design-custom' && (
          <div className={compact ? "" : "space-y-2 pt-1"}>
            {!compact && <label className="text-xs font-medium text-gray-500">Dimensions</label>}
            <input type="text" value={config.assetDimensions}
              onChange={e => setConfig(prev => ({ ...prev, assetDimensions: e.target.value }))}
              placeholder={compact ? "e.g. 1920x1080px, A4" : "e.g. 1920x1080px, A4, 210x297mm"}
              className={cn("w-full text-sm bg-gray-950 border border-gray-700/50 rounded-xl focus:outline-none focus:border-indigo-400 text-gray-100 placeholder:text-gray-500 transition-colors", compact ? "p-2.5" : "p-3")} />
          </div>
        )}
      </div>

      <div className={sectionCls(compact)}>
        <div>
          <p className="text-sm font-medium text-gray-400">Input Asset Proportions</p>
          <p className="text-xs text-gray-500 mt-0.5">Match {compact ? 'your attached image so it maps without distortion.' : 'the proportions of your attached image so it maps correctly without distortion.'}</p>
        </div>
        <div className={cn("grid grid-cols-3", gapCls(compact))}>
          {ASSET_RATIOS.map(r => (
            <TogglePill key={r.id} label={r.label} active={config.assetRatio === r.id}
              onClick={() => setConfig(prev => ({ ...prev, assetRatio: r.id as AssetRatioType }))} />
          ))}
        </div>
        {config.assetRatio === 'custom' && (
          <div className={compact ? "" : "space-y-2 pt-1"}>
            {!compact && <label className="text-xs font-medium text-gray-500">Custom ratio (e.g. 5:2, 7:3)</label>}
            <input type="text" value={config.customAssetRatio}
              onChange={e => setConfig(prev => ({ ...prev, customAssetRatio: e.target.value }))}
              placeholder="e.g. 5:2"
              className={cn("w-full text-sm bg-gray-950 border border-gray-700/50 rounded-xl focus:outline-none focus:border-indigo-400 text-gray-100 placeholder:text-gray-500 transition-colors", compact ? "p-2.5" : "p-3")} />
          </div>
        )}
      </div>

      <div className={sectionCls(compact)}>
        <p className="text-sm font-medium text-gray-400">Color Swatches</p>
        <ColorSwatchesUI {...colorSwatchProps} />
      </div>

      <div className={sectionCls(compact)}>
        <p className="text-sm font-medium text-gray-400">{compact ? 'Palette Description' : 'Color Palette Description'}</p>
        <input type="text" value={config.colorPalette ?? ''}
          onChange={e => setConfig(prev => ({ ...prev, colorPalette: e.target.value }))}
          placeholder="Warm neutrals, off-whites\u2026"
          className={cn("w-full text-sm bg-gray-950 border border-gray-700/50 rounded-xl focus:outline-none focus:border-indigo-400 text-gray-100 placeholder:text-gray-500 transition-colors", compact ? "p-2.5" : "p-3")} />
      </div>

      <div className={sectionCls(compact)}>
        <p className="text-sm font-medium text-gray-400">Asset Description</p>
        <textarea value={config.assetDescription}
          onChange={e => setConfig(prev => ({ ...prev, assetDescription: e.target.value }))}
          placeholder="e.g. A minimalist serif logo for a boutique hotel\u2026"
          className={cn("w-full text-sm bg-gray-950 border border-gray-700/50 rounded-xl focus:outline-none focus:border-indigo-400 resize-none text-gray-100 placeholder:text-gray-500 transition-colors", compact ? "h-20 p-2.5" : "h-24 p-3")} />
      </div>
    </div>
  );

  const renderExtras = (compact = false) => (
    <div className={compact ? "space-y-5" : "space-y-4"}>
      <div className={cardCls(compact)}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-400">Props</p>
          {config.props.length > 0 && (
            <button onClick={() => setConfig(prev => ({ ...prev, props: [] }))}
              className="text-xs text-gray-500 hover:text-indigo-400 transition-colors flex items-center gap-1">
              <RotateCcw size={compact ? 9 : 10} /> Clear{compact ? '' : ' all'}
            </button>
          )}
        </div>
        {!compact && <p className="text-xs text-gray-500 mt-1">Multi-select. Props appear near the hero object.</p>}
        <div className={cn("grid grid-cols-2", gapCls(compact))}>
          {PROPS.map(p => (
            <TogglePill key={p.id} label={p.label} active={config.props.includes(p.id as PropType)}
              onClick={() => toggleProp(p.id as PropType)} />
          ))}
        </div>
      </div>

      <div className={sectionCls(compact)}>
        <p className="text-sm font-medium text-gray-400">Hand Interaction</p>
        <div className={cn("grid grid-cols-2", gapCls(compact))}>
          {HANDS.map(h => (
            <TogglePill key={h.id} label={h.label} active={config.hand === h.id}
              onClick={() => setConfig(prev => ({ ...prev, hand: h.id as HandMode }))} />
          ))}
        </div>
      </div>

      {isScreenObject && (
        <div className={sectionCls(compact)}>
          <p className="text-sm font-medium text-gray-400">Screen Effects</p>
          <div className={cn("grid grid-cols-1", gapCls(compact))}>
            {SCREEN_EFFECTS.map(fx => (
              <TogglePill key={fx.id} label={fx.label} active={config.screenEffects.includes(fx.id as ScreenEffectType)}
                onClick={() => toggleScreenEffect(fx.id as ScreenEffectType)} />
            ))}
          </div>
        </div>
      )}

      <div className={sectionCls(compact)}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-400">Imperfections</p>
          {config.imperfections.length > 0 && (
            <button onClick={() => setConfig(prev => ({ ...prev, imperfections: [] }))}
              className="text-xs text-gray-500 hover:text-indigo-400 transition-colors flex items-center gap-1">
              <RotateCcw size={compact ? 9 : 10} /> Clear{compact ? '' : ' all'}
            </button>
          )}
        </div>
        {!compact && <p className="text-xs text-gray-500 mt-1">Ultra-subtle details for photographic realism.</p>}
        <div className={cn("grid grid-cols-2", gapCls(compact))}>
          {availableImperfections.map(imp => (
            <TogglePill key={imp.id} label={imp.label} active={config.imperfections.includes(imp.id as ImperfectionType)}
              onClick={() => toggleImperfection(imp.id as ImperfectionType)} />
          ))}
        </div>
      </div>
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // WIZARD MODE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const slideVariants = {
    enter: (dir: string) => ({ x: dir === 'forward' ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: string) => ({ x: dir === 'forward' ? -60 : 60, opacity: 0 }),
  };

  const stepInfo = WIZARD_STEPS[wizardStep];

  const renderWizardStep = () => {
    switch (stepInfo.id) {

      case 'presets': return (
        <div className="space-y-6">
          <button
            onClick={() => { setConfig(DEFAULT_CONFIG); goNext(); }}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border border-dashed border-gray-700 hover:border-indigo-400 hover:bg-indigo-500/10 transition-all duration-200 group">
            <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/10 transition-colors">
              <Plus size={20} className="text-gray-500 group-hover:text-indigo-400" />
            </div>
            <div className="text-left flex-1">
              <div className="text-base font-semibold text-gray-100 mb-0.5">Start from scratch</div>
              <div className="text-sm text-gray-400">Begin with default settings</div>
            </div>
            <ArrowRight size={16} className="text-gray-500 group-hover:text-indigo-400 transition-colors" />
          </button>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Built-in Presets</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BUILT_IN_PRESETS.map(preset => {
                const ObjIcon = OBJECT_ICONS[preset.config.object] || Package;
                return (
                  <button key={preset.name}
                    onClick={() => { loadPreset(preset); goNext(); }}
                    className="flex items-center gap-3 p-4 rounded-2xl border border-gray-700/50 bg-gray-800 hover:border-indigo-400/25 hover:bg-gray-700 transition-all duration-200 text-left group">
                    <div className="w-10 h-10 rounded-xl bg-gray-950 group-hover:bg-indigo-500/10 flex items-center justify-center shrink-0 transition-colors">
                      <ObjIcon size={17} className="text-gray-500 group-hover:text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-100 truncate">{preset.name}</div>
                      <div className="text-xs text-gray-400 truncate">{label(OBJECTS, preset.config.object)} · {label(CAMERAS, preset.config.camera)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {presets.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">My Presets</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {presets.map(preset => {
                  const ObjIcon = OBJECT_ICONS[preset.config.object] || Package;
                  return (
                    <div key={preset.name}
                      className="flex items-center gap-3 p-4 rounded-2xl border border-gray-700/50 bg-gray-800 hover:border-gray-700 transition-all group">
                      <div className="w-10 h-10 rounded-xl bg-gray-950 flex items-center justify-center shrink-0">
                        <ObjIcon size={17} className="text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-100 truncate">{preset.name}</div>
                        <div className="text-xs text-gray-400">{new Date(preset.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                      </div>
                      <button onClick={() => { loadPreset(preset); goNext(); }}
                        className="px-3 py-1.5 rounded-lg bg-gray-950 text-[12px] font-semibold text-gray-400 hover:bg-indigo-500/10 hover:text-indigo-400 transition-all">
                        Load
                      </button>
                      <button onClick={() => deletePreset(preset.name)} aria-label="Delete preset"
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100">
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

      case 'object': return renderObjectSelector();

      case 'details': return (
        <div className="space-y-5">
          {renderObjectDetails()}
          {renderMaterialFinish()}
        </div>
      );

      case 'camera': return (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800 p-5">
            {renderImageRatio()}
          </div>
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800 p-5">
            {renderCameraAngle()}
          </div>
        </div>
      );

      case 'environment': return (
        <div className="space-y-4">
          {renderInfiniteBackground()}
          {renderSurfaceSetting()}
        </div>
      );

      case 'lighting': return renderLighting();

      case 'style': return renderAssetInput();

      case 'extras': return renderExtras();

      case 'review': return (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {summaryPills.map(pill => (
              <span key={pill.k} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 border border-gray-700/50 rounded-full">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{pill.k}</span>
                <span className="text-xs font-medium text-gray-400">{pill.v}</span>
              </span>
            ))}
            {config.swatchColors.length > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-800 border border-gray-700/50 rounded-full">
                {config.swatchColors.map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-full border border-gray-700" style={{ backgroundColor: c }} />
                ))}
              </span>
            )}
          </div>

          <PromptPreview {...promptPreviewProps} maxH="50vh" />

          <div className="rounded-2xl border border-gray-700/50 bg-gray-800 p-5 space-y-3">
            <label className="text-sm font-medium text-gray-400">Save as Preset</label>
            <div className="flex gap-2">
              <input type="text" value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && savePreset()}
                placeholder="My preset name\u2026"
                className="flex-1 px-3 py-2.5 text-sm bg-gray-950 border border-gray-700/50 rounded-xl focus:outline-none focus:border-indigo-400 text-gray-100 placeholder:text-gray-500 transition-colors" />
              <button onClick={savePreset} disabled={!presetName.trim()}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                  presetSaved
                    ? "bg-green-400/15 text-green-400 border border-green-400/25"
                    : presetName.trim()
                      ? "bg-indigo-500 text-white hover:bg-indigo-400"
                      : "bg-gray-950 text-gray-500 border border-gray-700/50 cursor-not-allowed"
                )}>
                {presetSaved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save</>}
              </button>
            </div>
          </div>

          <button onClick={() => setUiMode('studio')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-700/50 text-sm font-medium text-gray-400 hover:border-indigo-400/25 hover:text-indigo-400 transition-all duration-200">
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
      <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col relative" style={{ fontFamily: SYSTEM_FONT }}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-700/50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
            <div className="flex items-center gap-2.5 mr-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-500 flex items-center justify-center">
                <Wand2 size={13} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[11px] font-semibold tracking-widest text-indigo-400 uppercase hidden sm:block">Nano Banana</span>
            </div>

            {/* Step progress dots */}
            <div className="flex-1 flex items-center justify-center gap-2">
              {WIZARD_STEPS.map((step, i) => (
                <button key={step.id}
                  onClick={() => goToStep(i)}
                  className={cn(
                    "transition-all duration-300 rounded-full",
                    i <= wizardStep ? "w-5 h-1.5 bg-indigo-400" : "w-1.5 h-1.5 bg-gray-700"
                  )} />
              ))}
            </div>

            <span className="text-xs font-mono text-gray-500 shrink-0">{wizardStep + 1}/{totalSteps}</span>
            <ModeSwitcher {...modeSwitcherProps} compact />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
            <AnimatePresence mode="wait" custom={wizardDirection}>
              <motion.div
                key={wizardStep}
                custom={wizardDirection}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}>

                {/* Step header */}
                <div className="mb-10 text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/25 mb-5">
                    {React.createElement(stepInfo.icon, { size: 13, className: "text-indigo-400" })}
                    <span className="text-xs font-semibold text-indigo-400">Step {wizardStep + 1} of {totalSteps}</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-100 mb-3 leading-tight text-balance">
                    {stepInfo.title}
                  </h1>
                  <p className="text-base text-gray-400 max-w-lg mx-auto">{stepInfo.subtitle}</p>
                </div>

                {renderWizardStep()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer nav */}
        <div className="sticky bottom-0 z-20 bg-gray-950/95 backdrop-blur-sm border-t border-gray-700/50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
            <button
              onClick={goBack}
              disabled={wizardStep === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                wizardStep === 0
                  ? "text-gray-500 cursor-not-allowed"
                  : "text-gray-400 hover:text-gray-100 hover:bg-gray-800 border border-gray-700/50"
              )}>
              <ArrowLeft size={15} />
              Back
            </button>

            <div className="flex-1" />

            {getStepIsSkippable(wizardStep) && (
              <button onClick={goNext}
                className="text-sm font-medium text-gray-500 hover:text-gray-400 transition-colors px-3 py-2.5">
                Skip
              </button>
            )}

            {wizardStep < totalSteps - 1 ? (
              <button onClick={goNext}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-400 transition-all duration-200">
                Continue
                <ArrowRight size={15} />
              </button>
            ) : (
              <button onClick={handleCopy}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                  copied
                    ? "bg-green-400/15 text-green-400 border border-green-400/25"
                    : "bg-indigo-500 text-white hover:bg-indigo-400"
                )}>
                {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Prompt</>}
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STUDIO MODE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Studio tab content renderer
  const renderStudioTab = () => {
    switch (studioTab) {

      case 'object': return (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-400">Object Type</p>
            {renderObjectSelector(true)}
          </div>
          {hasObjectDetails && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-400 pt-2 border-t border-gray-700/50">Object Details</p>
              {renderObjectDetails(true)}
            </div>
          )}
          {renderMaterialFinish(true)}
        </div>
      );

      case 'camera': return (
        <div className="space-y-5">
          {renderImageRatio(true)}
          <div className="pt-2 border-t border-gray-700/50">
            {renderCameraAngle(true)}
          </div>
        </div>
      );

      case 'scene': return (
        <div className="space-y-5">
          {renderInfiniteBackground(true)}
          {renderSurfaceSetting(true)}
        </div>
      );

      case 'lighting': return renderLighting(true);

      case 'style': return renderAssetInput(true);

      case 'extras': return renderExtras(true);

      default: return null;
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-gray-950 text-gray-100 relative" style={{ fontFamily: SYSTEM_FONT }}>

      {/* Top Nav Bar */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-sm border-b border-gray-700/50">
        <div className="px-4 md:px-6 h-14 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mr-4 shrink-0">
            <div className="w-7 h-7 rounded-xl bg-indigo-500 flex items-center justify-center">
              <Wand2 size={13} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold text-gray-100 hidden sm:block">Mockup Studio</span>
          </div>

          {/* Mode switcher */}
          <ModeSwitcher {...modeSwitcherProps} />

          <div className="flex-1" />

          {/* Status breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 text-[12px] text-gray-500">
            <span className="text-gray-400 font-medium">{label(OBJECTS, config.object)}</span>
            <span className="text-gray-500">·</span>
            <span>{config.camera === 'custom' ? 'Custom 3D' : label(CAMERAS, config.camera)}</span>
            <span className="text-gray-500">·</span>
            <span>{label(LIGHTINGS, config.lighting)}</span>
            <span className="text-gray-500">·</span>
            <span>{config.imageRatio}</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[12px] text-gray-500 ml-4">
            <Hash size={10} />
            <span className="font-mono">{wordCount}w</span>
          </div>

          {/* Presets */}
          <button onClick={() => setShowPresetPanel(!showPresetPanel)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all duration-200",
              showPresetPanel
                ? "border-indigo-400/25 bg-indigo-500/10 text-indigo-400"
                : "border-gray-700/50 bg-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-100"
            )}>
            <FolderOpen size={13} />
            <span className="hidden sm:inline">Presets</span>
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold ml-0.5">{presets.length + BUILT_IN_PRESETS.length}</span>
          </button>

          {/* Copy format toggle + copy button */}
          <div className="flex items-center rounded-xl border border-gray-700/50 overflow-hidden bg-gray-800">
            <button onClick={() => setCopyFormat('text')}
              className={cn("px-2.5 py-2 text-[11px] font-bold transition-all duration-200", copyFormat === 'text' ? "bg-indigo-500/10 text-indigo-400" : "text-gray-500 hover:text-gray-100")}>
              Text
            </button>
            <button onClick={() => setCopyFormat('json')}
              className={cn("px-2.5 py-2 text-[11px] font-bold transition-all duration-200 flex items-center gap-1", copyFormat === 'json' ? "bg-indigo-500/10 text-indigo-400" : "text-gray-500 hover:text-gray-100")}>
              <Braces size={10} /> JSON
            </button>
          </div>

          <button onClick={handleCopy}
            className={cn(
              "flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
              copied
                ? "bg-green-400/15 text-green-400 border border-green-400/25"
                : "bg-indigo-500 text-white hover:bg-indigo-400"
            )}>
            {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /><span className="hidden sm:inline"> Copy</span></>}
          </button>
        </div>
      </header>

      {/* Preset Panel (dropdown) */}
      <AnimatePresence>
        {showPresetPanel && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed top-14 right-4 z-50 w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
            <div className="p-4 border-b border-gray-700/50">
              <div className="flex items-center gap-2 mb-3">
                <input type="text" value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePreset()}
                  placeholder="Preset name\u2026"
                  className="flex-1 px-3 py-2 text-sm bg-gray-950 border border-gray-700/50 rounded-xl focus:outline-none focus:border-indigo-400 text-gray-100 placeholder:text-gray-500 transition-colors" />
                <button onClick={savePreset} disabled={!presetName.trim()}
                  className={cn(
                    "flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200",
                    presetSaved ? "bg-green-400/15 text-green-400 border border-green-400/25"
                      : presetName.trim() ? "bg-indigo-500 text-white hover:bg-indigo-400"
                        : "bg-gray-800 text-gray-500 border border-gray-700/50 cursor-not-allowed"
                  )}>
                  {presetSaved ? <><Check size={11} /> Saved</> : <><Save size={11} /> Save</>}
                </button>
              </div>

              <button onClick={() => setConfig(DEFAULT_CONFIG)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-700/50 text-xs font-medium text-gray-400 hover:border-gray-700 hover:text-gray-100 transition-all duration-200">
                <RotateCcw size={11} /> Reset to defaults
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              <div className="p-3 space-y-1">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-1 mb-2">Built-in</p>
                {BUILT_IN_PRESETS.map(preset => (
                  <button key={preset.name} onClick={() => loadPreset(preset)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-700 transition-all duration-200 text-left group">
                    <div className="w-6 h-6 rounded-lg bg-gray-950 flex items-center justify-center shrink-0">
                      {React.createElement(OBJECT_ICONS[preset.config.object] || Package, { size: 12, className: "text-gray-500" })}
                    </div>
                    <span className="text-sm font-medium text-gray-400 group-hover:text-gray-100 flex-1 truncate">{preset.name}</span>
                    <span className="text-[10px] text-indigo-400 font-bold border border-indigo-400/25 rounded-md px-1.5 py-0.5 shrink-0">Built-in</span>
                  </button>
                ))}

                {presets.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-1 mt-3 mb-2">My Presets</p>
                    {presets.map(preset => (
                      <div key={preset.name}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-700 transition-all duration-200 group">
                        <button onClick={() => loadPreset(preset)} className="flex-1 text-left text-sm font-medium text-gray-400 group-hover:text-gray-100 truncate">
                          {preset.name}
                        </button>
                        <button onClick={() => deletePreset(preset.name)} aria-label="Delete preset"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-500 hover:text-red-400 transition-all">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
                {presets.length === 0 && <p className="text-xs text-gray-500 py-2 text-center px-1">No saved presets yet</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for preset panel */}
      <AnimatePresence>
        {showPresetPanel && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowPresetPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* Main layout: Tab bar + content + preview */}
      <div className="flex-1 flex flex-col min-h-0 relative z-10">

        {/* Studio tab bar */}
        <div className="border-b border-gray-700/50 bg-gray-900 shrink-0">
          <div className="px-4 md:px-6 flex items-center gap-0 overflow-x-auto">
            {STUDIO_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = studioTab === tab.id;
              return (
                <button key={tab.id}
                  onClick={() => setStudioTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-all duration-200 whitespace-nowrap border-b-2 -mb-px",
                    isActive
                      ? "text-indigo-400 border-indigo-400"
                      : "text-gray-400 border-transparent hover:text-gray-100 hover:border-gray-700"
                  )}>
                  <Icon size={14} strokeWidth={2} />
                  {tab.label}
                </button>
              );
            })}

            <div className="flex-1" />

            {/* Prompt richness bar */}
            <div className="hidden md:flex items-center gap-3 py-3 pr-1">
              <div className="w-24">
                <div className="h-1 bg-gray-950 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                    animate={{ width: `${completeness.score}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-indigo-400 shrink-0">{completeness.label}</span>
            </div>
          </div>
        </div>

        {/* Content + Preview split */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* Options panel (left / scrollable) */}
          <div className="flex-1 overflow-y-auto">
            {/* Summary pills */}
            <div className="px-4 md:px-6 py-4 border-b border-gray-700/50 flex flex-wrap gap-1.5">
              {summaryPills.map(pill => (
                <button key={pill.k}
                  onClick={() => resetPillValue(pill.k)}
                  className="group flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 border border-gray-700/50 rounded-full hover:border-indigo-400/25 hover:bg-indigo-500/10 transition-all duration-200">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{pill.k}</span>
                  <span className="text-[12px] font-medium text-gray-400 group-hover:text-indigo-400">{pill.v}</span>
                  <X size={8} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              {config.swatchColors.length > 0 && (
                <button
                  onClick={() => setConfig(prev => ({ ...prev, swatchColors: [] }))}
                  className="group flex items-center gap-1 px-2.5 py-1 bg-gray-800 border border-gray-700/50 rounded-full hover:border-indigo-400/25 hover:bg-indigo-500/10 transition-all duration-200">
                  {config.swatchColors.map((c, i) => (
                    <div key={i} className="w-3.5 h-3.5 rounded-full border border-gray-700" style={{ backgroundColor: c }} />
                  ))}
                  <X size={8} className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                </button>
              )}
            </div>

            <div className="p-4 md:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={studioTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}>
                  {renderStudioTab()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Mobile: show prompt button */}
            <div className="md:hidden px-4 pb-4">
              <button
                onClick={() => setMobilePreviewOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-400 transition-all duration-200">
                <Sparkles size={14} />
                View Prompt
              </button>
            </div>
          </div>

          {/* Preview panel (right / desktop only) */}
          <div className="hidden md:flex w-[380px] min-w-[380px] border-l border-gray-700/50 bg-gray-900 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5">
              <PromptPreview {...promptPreviewProps} maxH="none" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-4 md:px-6 py-3.5 border-t border-gray-700/50 bg-gray-900 flex items-center justify-between gap-4">
        <p className="text-[11px] text-gray-500 font-medium">
          Built for design consistency by Benjamin Arnedo
        </p>
        <p className="text-[11px] text-gray-500/50 hidden md:block">
          {OBJECTS.length} objects · {CAMERAS.length} angles · {SURFACES.length} surfaces · {LIGHTINGS.length} lights
        </p>
      </footer>

      {/* Mobile prompt slide-up sheet */}
      <AnimatePresence>
        {mobilePreviewOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50 md:hidden"
              onClick={() => setMobilePreviewOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-gray-900 border-t border-gray-700/50 rounded-t-3xl overflow-hidden overscroll-contain"
              style={{ maxHeight: '80vh' }}>
              <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-100">Live Prompt</span>
                <button onClick={() => setMobilePreviewOpen(false)} aria-label="Close prompt preview"
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-all">
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 60px)' }}>
                <div className="p-4">
                  <PromptPreview {...promptPreviewProps} maxH="none" />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
