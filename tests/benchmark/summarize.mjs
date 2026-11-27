import { readFile, writeFile, mkdir } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';

const CASES = ['100', '1000', '10000'];
const QUERIES = ['QE01', 'QE02', 'QE03', 'QE04', 'QE05'];
const RESULTS = new URL('./results/', import.meta.url);
const DOCS = new URL('../../docs/pruebas/', import.meta.url);

const summaries = [];
for (const caseKey of CASES) {
  summaries.push(JSON.parse(await readFile(new URL(`${caseKey}-summary.json`, RESULTS), 'utf8')));
}
const rows = [];
for (const summary of summaries) {
  for (const query of QUERIES) {
    for (const motor of ['SQL', 'CYPHER']) {
      const values = summary.measurements[query][motor];
      rows.push({
        caso: summary.case, profundidad: summary.depth, consulta: query, motor,
        mediaMs: Number(values.mean.toFixed(3)),
        medianaMs: Number(values.median.toFixed(3)),
        p95Ms: Number(values.p95.toFixed(3)),
        desviacionMs: Number(values.stddev.toFixed(3)),
        tasaErrores: values.errorRate,
        resultados: values.resultCount,
      });
    }
  }
}
const totalMeasured = summaries.reduce((sum, item) => sum +
  Object.values(item.measurements).reduce((inner, query) => inner +
    Object.values(query).reduce((count, motor) => count + (motor.errorRate === 0 ? 30 : 30), 0), 0), 0);
const totalErrors = summaries.reduce((sum, item) => sum +
  Object.values(item.measurements).reduce((inner, query) => inner +
    Object.values(query).reduce((count, motor) => count + Math.round(motor.errorRate * 30), 0), 0), 0);
const equivalent = summaries.every((summary) => QUERIES.every((query) =>
  summary.baseline[query].sql === summary.baseline[query].cypher));
const document = {
  fecha: '2026-11-27',
  metodologia: 'Semilla 42; tres casos base 100/1000/10000 lotes con profundidades reales 3/8/15; diez componentes productivos independientes; 5 calentamientos y 30 repeticiones medidas por motor/consulta/caso; orden alternado de motor; comparación de hash antes de cronometrar.',
  totalMediciones: totalMeasured,
  totalCalentamientos: 150,
  errores: totalErrors,
  equivalenciaVerificada: equivalent,
  entorno: summaries[0].versions,
  casos: summaries.map((summary) => ({
    caso: summary.case, profundidad: summary.depth, topologia: summary.topology,
    hashesEquivalentes: Object.fromEntries(QUERIES.map((query) =>
      [query, summary.baseline[query].sql === summary.baseline[query].cypher])),
  })),
  resultados: rows,
  noEjecutado: [
    'Casos adicionales a volumen fijo 1000 variando profundidad 3/8/15 y topologías lineal, ramificada, convergente e independiente',
    'EXPLAIN ANALYZE y PROFILE separados de la latencia normal',
    'Comparación API extremo a extremo (solo se midió driver→motor→materialización)',
  ],
};
await mkdir(DOCS, { recursive: true });
await writeFile(new URL('benchmark-actual.json', DOCS), JSON.stringify(document, null, 2));
const header = 'caso,profundidad,consulta,motor,media_ms,mediana_ms,p95_ms,desviacion_ms,tasa_errores,resultados';
const csv = [header, ...rows.map((row) => [row.caso, row.profundidad, row.consulta, row.motor,
  row.mediaMs, row.medianaMs, row.p95Ms, row.desviacionMs, row.tasaErrores, row.resultados].join(','))].join('\n');
await writeFile(new URL('benchmark-actual.csv', DOCS), csv);
process.stdout.write(`BENCHMARK_SUMMARY=${JSON.stringify({ totalMeasured, totalErrors, equivalent, rows: rows.length })}\n`);
