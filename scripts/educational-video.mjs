import fs from 'node:fs';
import {assertValidProject} from './lib/project.mjs';

const [input, storyboard, output] = process.argv.slice(2);
if (!output) throw Error('Uso: educational-video.mjs pedido-edu.json storyboard.json projeto.json');
const request = JSON.parse(fs.readFileSync(input, 'utf8'));
const project = JSON.parse(fs.readFileSync(storyboard, 'utf8'));
if (request.contract?.name !== 'edu-studio.motion-studio' || request.contract.version !== '1.0') {
  throw Error('Contrato Edu Studio incompatível.');
}
for (const key of ['content','learningObjective','audience']) {
  if (typeof request[key] !== 'string' || !request[key].trim()) throw Error('Campo ausente: '+key);
}
project.audience = request.audience;
project.objective = request.learningObjective;
project.captions = {...project.captions, enabled:request.accessibility?.captions ?? true};
assertValidProject(project);
fs.writeFileSync(output,JSON.stringify(project,null,2)+'\n',{flag:'wx'});
