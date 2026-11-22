import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {SceneRenderer} from './SceneRenderer';
import {resolveTheme} from './themes';
import {getSceneDurationFrames, type MotionProject} from './types';

export const MotionStudio: React.FC<MotionProject> = (project) => {
  const tokens = resolveTheme(project);
  let from = 0;
  return (
    <AbsoluteFill style={{background: tokens.background, overflow: 'hidden'}}>
      {project.scenes.map((scene) => {
        const durationInFrames = getSceneDurationFrames(scene, project.video.fps);
        const sceneFrom = from;
        from += durationInFrames;
        return (
          <Sequence key={scene.id} from={sceneFrom} durationInFrames={durationInFrames} name={scene.title ?? scene.id} premountFor={Math.min(project.video.fps, durationInFrames)}>
            <SceneRenderer scene={scene} project={project} tokens={tokens} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

