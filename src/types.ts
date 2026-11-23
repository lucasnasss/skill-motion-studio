export type ThemeName =
  | 'minimal'
  | 'scientific'
  | 'editorial'
  | 'modern'
  | 'flat'
  | 'infographic';

export type ProjectMode = 'create' | 'edit' | 'hybrid';

export type VisualStyle =
  | 'print'
  | '3d-modern'
  | 'toy-3d'
  | 'talking-head'
  | 'mixed';

export type AnimationPreset =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom'
  | 'pop'
  | 'wipe'
  | 'draw';

export type Animation = {
  preset?: AnimationPreset;
  delaySeconds?: number;
  durationSeconds?: number;
  easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
};

export type Placement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number;
  opacity?: number;
  rotation?: number;
  enter?: Animation;
  exit?: Animation;
};

export type TextElement = Placement & {
  type: 'text';
  text: string;
  role?: 'eyebrow' | 'title' | 'subtitle' | 'body' | 'label' | 'number' | 'caption';
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  background?: string;
  padding?: number;
  borderRadius?: number;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  maxLines?: number;
};

export type ShapeElement = Placement & {
  type: 'shape';
  kind: 'rect' | 'rounded' | 'circle' | 'ring' | 'line' | 'arrow';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  shadow?: string;
};

export type ImageElement = Placement & {
  type: 'image';
  src: string;
  alt?: string;
  fit?: 'contain' | 'cover' | 'fill';
  borderRadius?: number;
};

export type VideoElement = Placement & {
  type: 'video';
  src: string;
  fit?: 'contain' | 'cover' | 'fill';
  borderRadius?: number;
  startFromSeconds?: number;
  endAtSeconds?: number;
  playbackRate?: number;
  volume?: number;
  muted?: boolean;
};

export type ThreeElement = Placement & {
  type: 'three';
  primitive?: 'box' | 'sphere' | 'torus' | 'cylinder' | 'cone';
  modelSrc?: string;
  style?: '3d-minimal' | 'toy-3d' | 'technical';
  material?: 'standard' | 'physical' | 'toon';
  color?: string;
  accentColor?: string;
  rotationSpeed?: [number, number, number];
  objectScale?: number;
  camera?: {
    position?: [number, number, number];
    target?: [number, number, number];
    fov?: number;
    orbitRadius?: number;
    orbitSpeed?: number;
  };
  lighting?: {
    ambient?: number;
    key?: number;
    fill?: number;
    shadows?: boolean;
  };
};

export type DiagramNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  textColor?: string;
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
  color?: string;
  directed?: boolean;
};

export type DiagramElement = Placement & {
  type: 'diagram';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

export type DataPoint = {label: string; value: number; color?: string};

export type ChartElement = Placement & {
  type: 'chart';
  chartType: 'bar' | 'line' | 'donut';
  data: DataPoint[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  min?: number;
  max?: number;
  showValues?: boolean;
  showLegend?: boolean;
  grid?: boolean;
};

export type ProcessElement = Placement & {
  type: 'process';
  steps: Array<{label: string; detail?: string; color?: string}>;
  orientation?: 'horizontal' | 'vertical';
  activeStep?: number;
};

export type MembraneElement = Placement & {
  type: 'membrane';
  mode:
    | 'structure'
    | 'simple-diffusion'
    | 'facilitated-diffusion'
    | 'osmosis'
    | 'active-transport';
  outsideLabel?: string;
  insideLabel?: string;
  channelLabel?: string;
  particleLabel?: string;
  particleColor?: string;
  highConcentration?: 'outside' | 'inside';
  energyLabel?: string;
};

export type Element =
  | TextElement
  | ShapeElement
  | ImageElement
  | VideoElement
  | ThreeElement
  | DiagramElement
  | ChartElement
  | ProcessElement
  | MembraneElement;

export type CaptionWord = {
  text: string;
  startSeconds: number;
  endSeconds: number;
  emphasis?: boolean;
};

export type CaptionCue = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  words?: CaptionWord[];
};

export type Scene = {
  id: string;
  title?: string;
  durationSeconds: number;
  background?: string;
  transition?: {
    type?: 'cut' | 'fade' | 'slide-left' | 'slide-up' | 'zoom';
    durationSeconds?: number;
  };
  narration?: string;
  audio?: {src: string; volume?: number; loop?: boolean; playbackRate?: 1};
  captions?: CaptionCue[];
  elements: Element[];
};

export type MediaAsset = {
  id: string;
  type: 'video' | 'audio' | 'image' | 'model3d';
  src: string;
  author?: string;
  source?: string;
  license: string;
  durationSeconds?: number;
};

export type TimelineClip = {
  id: string;
  assetId?: string;
  startSeconds: number;
  durationSeconds: number;
  inPointSeconds?: number;
  outPointSeconds?: number;
  sceneId?: string;
  volume?: number;
  playbackRate?: number;
  text?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type TimelineTrack = {
  id: string;
  type: 'video' | 'audio' | 'caption' | 'overlay' | 'three';
  muted?: boolean;
  clips: TimelineClip[];
};

export type EditableTimeline = {
  durationSeconds?: number;
  tracks: TimelineTrack[];
};

export type MotionProject = {
  version: '1.0' | '2.0';
  mode?: ProjectMode;
  style?: VisualStyle;
  title: string;
  prompt?: string;
  objective: string;
  audience: string;
  language: string;
  theme: ThemeName;
  video: {
    width: number;
    height: number;
    fps: number;
    safeMarginPct?: number;
  };
  palette?: Partial<Palette>;
  typography?: {
    titleFont?: string;
    bodyFont?: string;
    titleWeight?: number;
    bodyWeight?: number;
  };
  captions?: {
    enabled?: boolean;
    burnIn?: boolean;
    position?: 'top' | 'center' | 'bottom';
    fontSize?: number;
    color?: string;
    background?: string;
    style?: 'traditional' | 'highlight' | 'karaoke';
    highlightColor?: string;
    maxWordsPerLine?: number;
  };
  assets?: {
    attributions?: Array<{file: string; author?: string; source?: string; license: string}>;
  };
  media?: MediaAsset[];
  timeline?: EditableTimeline;
  edit?: {
    intensity?: 'conservative' | 'dynamic' | 'editorial';
    sourceAssetId?: string;
    keepRanges?: Array<{startSeconds: number; endSeconds: number; reason?: string}>;
    normalizeAudio?: boolean;
    targetAspect?: 'source' | '16:9' | '9:16' | '1:1';
  };
  tts?: {
    provider?: 'onecore' | 'kokoro' | 'elevenlabs';
    voice?: string;
    model?: string;
    preset?: 'educational' | 'documentary' | 'social' | 'institutional';
    speed?: number;
    style?: number;
    stability?: number;
    similarityBoost?: number;
  };
  scenes: Scene[];
};

export type Palette = {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
};

export type ThemeTokens = Palette & {
  gradient: string;
  titleFont: string;
  bodyFont: string;
  titleWeight: number;
  bodyWeight: number;
};

export const getSceneDurationFrames = (scene: Scene, fps: number) =>
  Math.max(1, Math.round(scene.durationSeconds * fps));

export const getProjectDurationFrames = (project: MotionProject) =>
  project.scenes.reduce(
    (sum, scene) => sum + getSceneDurationFrames(scene, project.video.fps),
    0,
  );

