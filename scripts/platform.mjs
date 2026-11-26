import fs from 'node:fs';
import {assertValidProject} from './lib/project.mjs';
const [input,preset,output] = process.argv.slice(2);
const {presets} = JSON.parse(fs.readFileSync(new URL('../assets/platforms.json', import.meta.url)));
if (!Object.hasOwn(presets,preset) || !output) throw Error('Uso: platform.mjs projeto.json '+Object.keys(presets).join('|')+' saida.json');
const project = JSON.parse(fs.readFileSync(input));
project.video = {...project.video,...presets[preset]};
assertValidProject(project);
fs.writeFileSync(output,JSON.stringify(project,null,2)+'\n',{flag:'wx'});
