import React from 'react';
import {Composition, type CalculateMetadataFunction} from 'remotion';
import template from '../assets/project-template.json';
import {MotionStudio} from './MotionStudio';
import {getProjectDurationFrames, type MotionProject} from './types';

const DEFAULT_PROJECT = template as MotionProject;

const calculateMetadata: CalculateMetadataFunction<MotionProject> = ({props}) => {
  if (!props.scenes?.length) throw new Error('O projeto precisa conter pelo menos uma cena.');
  return {
    width: props.video.width,
    height: props.video.height,
    fps: props.video.fps,
    durationInFrames: getProjectDurationFrames(props),
    props,
  };
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MotionStudio"
    component={MotionStudio}
    durationInFrames={getProjectDurationFrames(DEFAULT_PROJECT)}
    fps={DEFAULT_PROJECT.video.fps}
    width={DEFAULT_PROJECT.video.width}
    height={DEFAULT_PROJECT.video.height}
    defaultProps={DEFAULT_PROJECT}
    calculateMetadata={calculateMetadata}
  />
);

