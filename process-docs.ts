
import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';
import { execSync } from 'child_process';
import hljs from 'highlight.js';
import { format } from 'pg-formatter';

// --- generate JS for Monaco editor ---

const recurseNodes = (node: string): string[] =>
  fs.statSync(node).isFile() ? [node] :
    fs.readdirSync(node).reduce<string[]>((memo, n) =>
      memo.concat(recurseNodes(path.join(node, n))), []);

const all = recurseNodes('zapatos').reduce<{ [k: string]: string; }>((memo, path) => {
  memo[path] = fs.readFileSync(path, { encoding: 'utf8' });
  return memo;
}, {});

Object.assign(all, {
  // stubs for key pg types
  'pg.ts': `
export interface Pool {}
export interface PoolClient {}
export interface QueryResult {
  rows: any;
}
`,
  // pretend pg.Pool
  'pgPool.ts': `
import * as pg from 'pg';
export let pool: pg.Pool;
`,
  // workaround for Monaco Editor not finding index.ts inside folders:
  'zapatos/src.ts': `
export * from './src/index';
`,
});

fs.writeFileSync('files.js', `const files = ${JSON.stringify(all)};`);


// --- run TS code ---

const
  pullLeft = (s: string) => {
    const
      indent = [...s.matchAll(/^\s+(?=\S)/gm)]
        .reduce((memo, match) => Math.min(memo, match[0].length), Infinity),
      re = new RegExp(`^\\s{${indent}}`, 'gm'),
      pulled = s.replace(re, '');

    return pulled;
  },
  md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: async (str: string, lang: string) => {
      let output = '';
      const runnableTS = lang === 'typescript' && str.match(/^import/m);
      if (lang && hljs.getLanguage(lang)) {
        try {
          output = `<pre class="language-${lang}${runnableTS ? ' runnable' : ''}"><code>${hljs.highlight(lang, str).value.replace(/\n/g, '<br>')}</code></pre>`;
        } catch (err) {
          console.log('Highlighting error', err);
        }
        if (runnableTS) {
          console.log('Running TS: ...');
          const src = `
            import * as xyz from './zapatos/src';
            xyz.setConfig({ 
              queryListener: (x) => {
                console.log('<<<text>>>' + x.text + ';');
                if (x.values.length) console.log('<<<values>>>' + JSON.stringify(x.values, null, 2));
              },
              resultListener: (x) => {
                console.log('<<<result>>>' + JSON.stringify(x, null, 2));
              }
            });
            
            ${str}
          `;
          fs.writeFileSync('tmp.ts', src, { encoding: 'utf8' });
          // const { stdout, stderr } = await exec('tsc --noEmit tmp.ts');
          const
            stdout = execSync('node --harmony-top-level-await --loader @k-foss/ts-esnode --experimental-specifier-resolution=node tmp.ts'),
            parts = stdout.toString().split('<<<');

          output += '<div class="sqlstuff">'
          for (const part of parts) {
            const [type, str] = part.split('>>>');

            if (type === 'text') {
              const
                fmtSql = format(str, { spaces: 2 }),
                highlightSql = hljs.highlight('sql', fmtSql).value.trim().replace(/\n/g, '<br>');

              output += `<pre class="sqltext"><code>${highlightSql}</code></pre>`;

            } else if (type === 'values') {
              const highlightValues = hljs.highlight('json', str).value.replace(/\n/g, '<br>');

              output += `<pre class="sqlvalues"><code>${highlightValues}</code></pre>`;

            } else if (type === 'result') {
              const highlightResult = hljs.highlight('json', str).value.replace(/\n/g, '<br>');

              output += `<pre class="sqlresult"><code>${highlightResult}</code></pre>`;
            }
          }
          output += '</div>'
        }
      }
      return output;
    }
  }),
  src = fs.readFileSync('docs.md', { encoding: 'utf8' }),
  htmlContent = await md.render(src),
  html = pullLeft(`<!DOCTYPE html>
    <html>
      <head>
        <!-- tocbot -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/tocbot/4.11.1/tocbot.min.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tocbot/4.11.1/tocbot.css">
        <!-- highlighting -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.18.1/styles/default.min.css">
        <!-- monaco editor -->
        <script src="node_modules/monaco-editor/min/vs/loader.js"></script>
        <script src="files.js"></script>
        <!-- custom -->
        <link rel="stylesheet" href="https://use.typekit.net/mdb7zvi.css">
        <link rel="stylesheet" href="docs.css">
      </head>
      <body>
        <div id="toc"></div>
        <div id="content">${htmlContent}</div>
        <script src="docs.js"></script>
      </body>
    </html>
  `);

fs.writeFileSync('docs.html', html, { encoding: 'utf8' });


