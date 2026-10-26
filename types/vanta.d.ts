// Vanta ships UMD bundles without types; it is driven with its own three.js r134 ("three-vanta").
declare module 'vanta/dist/vanta.net.min' {
  const NET: (options: Record<string, unknown>) => { destroy(): void; resize(): void };
  export default NET;
}
declare module 'three-vanta';
