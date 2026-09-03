'use client';

import { useEffect, useRef, useCallback } from 'react';
import { FastenerData } from '@/lib/types';
import { createFastenerModel, createFastenerScene } from '@/components/three/FastenerScene';

interface ModelViewerProps {
  fastener: FastenerData | null;
}

export default function ModelViewer({ fastener }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ReturnType<typeof createFastenerScene> | null>(null);

  const initScene = useCallback(() => {
    if (!containerRef.current) return;
    
    // 清理旧场景
    if (sceneRef.current) {
      sceneRef.current.controls.dispose();
      if (containerRef.current.contains(sceneRef.current.renderer.domElement)) {
        containerRef.current.removeChild(sceneRef.current.renderer.domElement);
      }
    }

    // 创建默认空组或模型
    const group = fastener 
      ? createFastenerModel(fastener)
      : createEmptyGroup();

    const scene = createFastenerScene(containerRef.current, group);
    sceneRef.current = scene;
  }, [fastener]);

  useEffect(() => {
    initScene();

    const handleResize = () => {
      if (!sceneRef.current || !containerRef.current) return;
      const { camera, renderer } = sceneRef.current;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) {
        sceneRef.current.controls.dispose();
      }
    };
  }, [initScene]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[500px] rounded-lg overflow-hidden cursor-grab active:cursor-grabbing relative"
    >
      {!fastener && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-blue-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1m0 0L10 4m2-1v2.5M6 7l-2 1m2-1l-2-1m2 1v2.5" />
            </svg>
            <p className="text-slate-500 text-sm">选择或解析紧固件</p>
            <p className="text-slate-600 text-xs mt-1">3D模型将在此处显示</p>
          </div>
        </div>
      )}
    </div>
  );
}

function createEmptyGroup() {
  const { Group } = require('three');
  return new Group();
}