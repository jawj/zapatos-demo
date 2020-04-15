
import * as fs from 'fs';
import * as MarkdownIt from 'markdown-it';
const hljs = require('highlight.js');

const
  md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (str: string, lang: string) => {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(lang, str).value;
        } catch (__) { }
      }
      return '';
    }
  }),
  src = fs.readFileSync('docs.md', { encoding: 'utf8' }),
  htmlContent = md.render(src),
  html = `
    <!DOCTYPE html><html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/tocbot/4.11.1/tocbot.min.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tocbot/4.11.1/tocbot.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.18.1/styles/default.min.css">
        <link rel="stylesheet" href="docs.css">
      </head>
      <body>
        <div id="toc"></div>
        <div id="content">${htmlContent}</div>
        <script src="docs.js"></script>
      </body>
    </html>
    `;

fs.writeFileSync('docs.html', html, { encoding: 'utf8' });
