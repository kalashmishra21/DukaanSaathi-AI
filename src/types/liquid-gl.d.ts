declare module "liquid-gl" {
  export type LiquidGLInstance = { destroy?: () => void };
  export default function liquidGL(options: {
    target: string;
    snapshot: string;
    engine: "webgl2";
    resolution: number;
    refraction: number;
    bevelWidth: number;
    bevelDepth: number;
    frost: number;
    shadow: boolean;
    specular: boolean;
    tint: string;
    interaction: "none";
    reveal: "none";
  }): LiquidGLInstance;
}
