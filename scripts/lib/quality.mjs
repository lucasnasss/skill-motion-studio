export const findTextOverlaps = (project) => {
  const issues = [];
  for (const scene of project.scenes ?? []) {
    const texts = (scene.elements ?? []).filter((element) => element.type === 'text' && (element.opacity ?? 1) > 0);
    for (let leftIndex = 0; leftIndex < texts.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < texts.length; rightIndex += 1) {
        const left = texts[leftIndex];
        const right = texts[rightIndex];
        const overlapWidth = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
        const overlapHeight = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
        const overlapArea = overlapWidth * overlapHeight;
        const smallerArea = Math.min(left.width * left.height, right.width * right.height);
        if (smallerArea > 0 && overlapArea / smallerArea > 0.18) {
          issues.push({sceneId: scene.id, left: left.id, right: right.id, overlapRatio: Number((overlapArea / smallerArea).toFixed(3))});
        }
      }
    }
  }
  return issues;
};

export const projectQuality = (project) => {
  const warnings = [];
  const failures = [];
  const textOverlaps = findTextOverlaps(project);
  for (const overlap of textOverlaps) {
    warnings.push(`Possível sobreposição de texto em ${overlap.sceneId}: ${overlap.left} × ${overlap.right} (${overlap.overlapRatio}).`);
  }
  for (const scene of project.scenes ?? []) {
    if (scene.durationSeconds < 0.6) warnings.push(`Cena ${scene.id} dura menos de 0,6 s e pode ser ilegível.`);
    if (project.captions?.burnIn && (project.captions.fontSize ?? 42) < 24) warnings.push('Legenda incorporada usa tamanho inferior a 24 px.');
    for (const cue of scene.captions ?? []) {
      const wordsPerSecond = cue.text.trim().split(/\s+/).length / Math.max(0.001, cue.endSeconds - cue.startSeconds);
      if (wordsPerSecond > 4.2) warnings.push(`Legenda ${scene.id}/${cue.id} excede 4,2 palavras por segundo.`);
    }
  }
  if (!(project.scenes ?? []).length) failures.push('Projeto sem cenas.');
  return {pass: failures.length === 0, failures, warnings, textOverlaps};
};

export const parseBlackDetect = (text) => {
  const starts = [...text.matchAll(/black_start:([0-9.]+)/g)].map((match) => Number(match[1]));
  const ends = [...text.matchAll(/black_end:([0-9.]+)\s+black_duration:([0-9.]+)/g)].map((match) => ({endSeconds: Number(match[1]), durationSeconds: Number(match[2])}));
  return ends.map((end, index) => ({startSeconds: starts[index] ?? Math.max(0, end.endSeconds - end.durationSeconds), ...end}));
};

export const unexpectedBlackSegments = (segments, durationSeconds, toleranceSeconds = 0.08) =>
  segments.filter((segment) => {
    const edge = segment.startSeconds <= toleranceSeconds || segment.endSeconds >= durationSeconds - toleranceSeconds;
    return !edge && segment.durationSeconds >= 0.5;
  });

