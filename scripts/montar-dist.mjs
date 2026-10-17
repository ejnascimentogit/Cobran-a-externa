// Junta os dois sites num só: painel em "/" e app do motoqueiro em "/motoqueiro/".
// Na demonstração (dados no localStorage) os dois precisam estar na mesma origem para
// o painel enxergar, ao vivo, o que o app registra.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('apps/painel/dist', 'dist', { recursive: true });
cpSync('apps/motoqueiro/dist', 'dist/motoqueiro', { recursive: true });
console.log('dist/ pronto: painel em / e motoqueiro em /motoqueiro/');
