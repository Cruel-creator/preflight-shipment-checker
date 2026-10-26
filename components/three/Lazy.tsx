'use client';
import dynamic from 'next/dynamic';

// Three.js is browser-only and heavy: load it after hydration, never on the server.
export const ConveyorScene = dynamic(() => import('./ConveyorScene'), { ssr: false });
